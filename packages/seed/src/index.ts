import { getClient, ids } from "@aiornot/db";
import type { Client } from "@libsql/client";
import { buildVariantPrompt, promptSummary, SEED_CATEGORIES } from "./prompts";
import { storeImage } from "./store-image";

export { SEED_CATEGORIES } from "./prompts";
export { seedStorageConfigured } from "./storage";
export { mediaStorageDir } from "./media-dir";
export { seedPool } from "./pool";
export { generateContinuousBatch } from "./continuous";

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 56) ||
    "media"
  );
}

async function uniqueSlug(client: Client, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 60; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const r = await client.execute({ sql: "SELECT 1 FROM media WHERE slug = ? LIMIT 1", args: [cand] });
    if (r.rows.length === 0) return cand;
  }
  return `${base}-${Date.now().toString(36)}`;
}

async function tagId(client: Client, slug: string): Promise<string | null> {
  const r = await client.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [slug] });
  return (r.rows[0]?.id as string) ?? null;
}

async function attachTags(client: Client, mediaId: string, slugs: string[]) {
  for (const s of slugs) {
    const id = await tagId(client, s);
    if (id) {
      await client.execute({
        sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)",
        args: [mediaId, id],
      });
    }
  }
}

async function startBatch(
  client: Client,
  name: string,
  source: "unsplash" | "openai",
  category: string | null,
  requested: number,
): Promise<string> {
  const id = ids.seedBatch();
  await client.execute({
    sql: `INSERT INTO seed_batches (id, name, source, category, status, total_requested)
          VALUES (?, ?, ?, ?, 'running', ?)`,
    args: [id, name, source, category, requested],
  });
  return id;
}

async function finishBatch(client: Client, id: string, imported: number, generated: number, failed = false) {
  await client.execute({
    sql: `UPDATE seed_batches SET status = ?, total_imported = ?, total_generated = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [failed ? "failed" : "complete", imported, generated, id],
  });
}

// ---- Unsplash --------------------------------------------------------------

type UnsplashPhoto = {
  id: string;
  description: string | null;
  alt_description: string | null;
  width: number;
  height: number;
  color: string | null;
  blur_hash: string | null;
  urls: { regular: string; small: string; raw: string };
  links: { html: string; download_location: string };
  user: { name: string; username: string; links: { html: string } };
};

export async function importUnsplashBatch(opts: {
  query: string;
  count: number;
  orientation?: "portrait" | "landscape" | "squarish";
  client?: Client;
}): Promise<{ batchId: string; imported: number }> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("UNSPLASH_ACCESS_KEY is not set.");
  const client = opts.client ?? getClient();
  const category = opts.query;
  const batchId = await startBatch(client, `Unsplash: ${category}`, "unsplash", category, opts.count);
  let imported = 0;

  try {
    const perPage = Math.min(30, opts.count);
    const url = new URL("https://api.unsplash.com/search/photos");
    url.searchParams.set("query", opts.query);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("content_filter", "high");
    if (opts.orientation) url.searchParams.set("orientation", opts.orientation);

    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
    if (!res.ok) throw new Error(`Unsplash search failed (${res.status})`);
    const data = (await res.json()) as { results: UnsplashPhoto[] };

    const catTag = slugify(category.replace(/ photography$/, ""));
    for (const p of data.results.slice(0, opts.count)) {
      const dupe = await client.execute({ sql: "SELECT 1 FROM unsplash_photos WHERE unsplash_id = ?", args: [p.id] });
      if (dupe.rows.length > 0) continue;

      const title = (p.description || p.alt_description || `${category} photo`).slice(0, 120);
      const mediaId = ids.media();
      const slug = await uniqueSlug(client, title);
      await client.execute({
        sql: `INSERT INTO media
          (id, slug, media_type, title, description, media_url, thumbnail_url, original_url,
           source_url, source_domain, source_provider, seed_source, truth_label, truth_confidence,
           reveal_status, status, width, height, ai_model, approved_at)
          VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, 'unsplash.com', 'unsplash', 'unsplash', 'not_ai',
                  'seeded', 'hidden_until_guess', 'approved', ?, ?, NULL, CURRENT_TIMESTAMP)`,
        args: [
          mediaId, slug, title, p.alt_description, p.urls.regular, p.urls.small, p.urls.raw,
          p.links.html, p.width, p.height,
        ],
      });
      await client.execute({
        sql: `INSERT INTO unsplash_photos
          (media_id, unsplash_id, photographer_name, photographer_username, photographer_url,
           unsplash_html_url, unsplash_download_location, blur_hash, color, raw_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          mediaId, p.id, p.user.name, p.user.username, p.user.links.html,
          p.links.html, p.links.download_location, p.blur_hash, p.color, JSON.stringify(p),
        ],
      });
      await client.execute({ sql: "INSERT OR IGNORE INTO media_stats (media_id) VALUES (?)", args: [mediaId] });
      await attachTags(client, mediaId, [catTag, "photorealistic", "human-made", "image"]);

      // Per Unsplash API guidelines, trigger the download endpoint.
      fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
      imported++;
    }
    await finishBatch(client, batchId, imported, 0);
  } catch (err) {
    await finishBatch(client, batchId, imported, 0, true);
    throw err;
  }
  return { batchId, imported };
}

// ---- OpenAI AI variants ----------------------------------------------------

const OPENAI_IMAGE_SIZE = "1024x1536";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Call OpenAI image generation with retry/backoff; returns raw PNG bytes. */
async function generateVariantImage(prompt: string, model: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(1500 * 2 ** (attempt - 1)); // 1.5s, 3s, 6s
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size: OPENAI_IMAGE_SIZE, n: 1 }),
    });
    if (res.ok) {
      const gen = (await res.json()) as { data: Array<{ b64_json?: string; url?: string }> };
      const item = gen.data[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
      if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
      throw new Error("OpenAI returned no image data.");
    }
    lastErr = `${res.status}: ${(await res.text()).slice(0, 150)}`;
    // Retry transient errors; fail fast on client errors (except rate limit).
    if (res.status !== 429 && res.status < 500) break;
  }
  throw new Error(`OpenAI image gen failed (${lastErr})`);
}

/** Generate one photorealistic AI variant, store the image, insert the media row. */
export async function createAiVariant(
  client: Client,
  opts: {
    category: string;
    caption?: string;
    description?: string;
    tags?: string[];
    parentId?: string | null;
    model?: string;
    seed?: number;
  },
): Promise<{ mediaId: string; slug: string; mediaUrl: string }> {
  const model = opts.model || process.env.AI_IMAGE_MODEL || "gpt-image-1";
  const category = opts.category;
  const caption = opts.caption || category;
  const categorySlug = slugify(category.replace(/ photography$/, ""));

  // Subject tags the image must actually depict (drives both the prompt and the
  // tags we store, so they can't disagree).
  const subjectTags = (opts.tags && opts.tags.length ? opts.tags : [categorySlug])
    .map((t) => slugify(t))
    .filter((t) => t && !["photorealistic", "ai-generated", "human-made", "image", "video"].includes(t));

  const prompt = buildVariantPrompt(category, caption, opts.seed ?? Date.now() + Math.floor(Math.random() * 1e6), {
    tags: subjectTags,
    description: opts.description,
  });

  const buf = await generateVariantImage(prompt, model);
  const hash = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const mediaUrl = await storeImage(`ai-variants/${hash}.png`, buf, "image/png");

  // Neutral title — must NOT reveal the answer (both AI and real items use the
  // same "AI or Not: <subject>" style).
  const primary = (subjectTags[0] || categorySlug).replace(/-/g, " ");
  const title = `AI or Not: ${primary.charAt(0).toUpperCase()}${primary.slice(1)}`;
  const mediaId = ids.media();
  const slug = await uniqueSlug(client, title);
  await client.execute({
    sql: `INSERT INTO media
      (id, slug, media_type, title, description, media_url, thumbnail_url, source_provider, seed_source,
       source_parent_media_id, truth_label, truth_confidence, reveal_status, status,
       width, height, ai_prompt_summary, ai_model, approved_at)
      VALUES (?, ?, 'image', ?, ?, ?, ?, 'openai', 'openai', ?, 'ai', 'seeded',
              'hidden_until_guess', 'approved', 1024, 1536, ?, ?, CURRENT_TIMESTAMP)`,
    args: [mediaId, slug, title, opts.description ?? null, mediaUrl, mediaUrl, opts.parentId ?? null, promptSummary(category), model],
  });
  await client.execute({ sql: "INSERT OR IGNORE INTO media_stats (media_id) VALUES (?)", args: [mediaId] });
  await attachTags(client, mediaId, [...subjectTags, "photorealistic", "ai-generated", "image"]);
  return { mediaId, slug, mediaUrl };
}

export async function generateAiVariantsBatch(opts: {
  count: number;
  client?: Client;
}): Promise<{ batchId: string; generated: number }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
  const client = opts.client ?? getClient();
  const batchId = await startBatch(client, "OpenAI AI variants", "openai", null, opts.count);
  let generated = 0;
  try {
    const parents = await client.execute({
      sql: `SELECT m.id, m.title, m.description FROM media m
            WHERE m.seed_source = 'unsplash' AND m.truth_label = 'not_ai'
            ORDER BY RANDOM() LIMIT ?`,
      args: [opts.count],
    });
    for (let i = 0; i < opts.count; i++) {
      const parent = parents.rows[i % Math.max(1, parents.rows.length)];
      // Use the parent's real subject tags so the generated image (and its tags)
      // match, instead of an arbitrary index-based category.
      let tags: string[] = [];
      if (parent?.id) {
        const tr = await client.execute({
          sql: `SELECT t.slug FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
                WHERE mt.media_id = ? AND t.is_answer_spoiler = 0
                  AND t.slug NOT IN ('image','video','photorealistic')`,
          args: [parent.id],
        });
        tags = tr.rows.map((r) => r.slug as string);
      }
      const category = tags[0] ? `${tags[0]} photography` : SEED_CATEGORIES[i % SEED_CATEGORIES.length]!;
      const caption = (parent?.title as string) || (parent?.description as string) || tags.join(", ");
      await createAiVariant(client, {
        category,
        caption,
        description: (parent?.description as string) ?? undefined,
        tags: tags.length ? tags : undefined,
        parentId: (parent?.id as string) ?? null,
        seed: i,
      });
      generated++;
    }
    await finishBatch(client, batchId, 0, generated);
  } catch (err) {
    await finishBatch(client, batchId, 0, generated, true);
    throw err;
  }
  return { batchId, generated };
}

// Shared helpers reused by the pool orchestrator (pool.ts).
export { startBatch, finishBatch, uniqueSlug, attachTags, slugify };
export type { Client };
