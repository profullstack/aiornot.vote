import { getClient, ids } from "@aiornot/db";
import type { Client } from "@libsql/client";
import { SEED_CATEGORIES } from "./prompts";
import { createAiVariant, slugify } from "./index";

async function tagId(client: Client, slug: string): Promise<string | null> {
  const r = await client.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [slug] });
  return (r.rows[0]?.id as string) ?? null;
}
async function attachTags(client: Client, mediaId: string, slugs: string[]) {
  for (const s of slugs) {
    const id = await tagId(client, s);
    if (id) await client.execute({ sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)", args: [mediaId, id] });
  }
}
async function uniqueSlug(client: Client, base: string): Promise<string> {
  const b = slugify(base);
  for (let i = 0; i < 60; i++) {
    const cand = i === 0 ? b : `${b}-${i + 1}`;
    const r = await client.execute({ sql: "SELECT 1 FROM media WHERE slug = ? LIMIT 1", args: [cand] });
    if (r.rows.length === 0) return cand;
  }
  return `${b}-${Date.now().toString(36)}`;
}

const REAL_SUBJECTS = ["portrait", "landscape", "street-photo", "architecture", "animal", "food", "travel", "product", "sports", "close-up"];

/** Add one real (not-AI) photo sourced from picsum.photos (genuine photographs). */
async function createRealPhoto(client: Client): Promise<void> {
  const subject = REAL_SUBJECTS[Math.floor(Math.random() * REAL_SUBJECTS.length)]!;
  const seed = Math.random().toString(36).slice(2, 12);
  const mediaUrl = `https://picsum.photos/seed/${seed}/1000/1250`;
  const thumbnailUrl = `https://picsum.photos/seed/${seed}/500/625`;
  // Neutral title — same style as AI items so it never reveals the answer.
  const s = subject.replace(/-/g, " ");
  const title = `AI or Not: ${s.charAt(0).toUpperCase()}${s.slice(1)}`;
  const mediaId = ids.media();
  const slug = await uniqueSlug(client, title);
  await client.execute({
    sql: `INSERT INTO media
      (id, slug, media_type, title, media_url, thumbnail_url, original_url, source_provider,
       seed_source, truth_label, truth_confidence, reveal_status, status, width, height, approved_at)
      VALUES (?, ?, 'image', ?, ?, ?, ?, 'url', 'manual', 'not_ai', 'seeded',
              'hidden_until_guess', 'approved', 1000, 1250, CURRENT_TIMESTAMP)`,
    args: [mediaId, slug, title, mediaUrl, thumbnailUrl, mediaUrl],
  });
  await client.execute({ sql: "INSERT OR IGNORE INTO media_stats (media_id) VALUES (?)", args: [mediaId] });
  await attachTags(client, mediaId, [subject, "photorealistic", "human-made", "image"]);
}

/**
 * Continuously top up the playable pool with a small, balanced batch of fresh
 * media so players never run out. Each item is the currently-underrepresented
 * truth label (AI vs real), keeping the game roughly 50/50. AI needs
 * OPENAI_API_KEY; real photos come from picsum (no key required).
 */
export async function generateContinuousBatch(opts: { count?: number; client?: Client } = {}): Promise<{ ai: number; real: number }> {
  const client = opts.client ?? getClient();
  const count = Math.max(1, opts.count ?? 3);
  const haveOpenai = !!process.env.OPENAI_API_KEY;
  let ai = 0;
  let real = 0;

  for (let i = 0; i < count; i++) {
    const c = await client.execute("SELECT SUM(CASE WHEN truth_label='ai' THEN 1 ELSE 0 END) a, SUM(CASE WHEN truth_label='not_ai' THEN 1 ELSE 0 END) n FROM media WHERE status='approved'");
    const aiN = Number(c.rows[0]?.a ?? 0);
    const realN = Number(c.rows[0]?.n ?? 0);
    // Always top up the CURRENTLY-UNDERREPRESENTED class so the pool trends 50/50.
    // Prefer AI on ties (it's the harder half to source).
    const wantAi = aiN <= realN;
    // Critical: if AI is the class we need but we can't make it (no OPENAI_API_KEY),
    // SKIP this iteration. Falling back to a real photo here only deepens the skew
    // — which is exactly what flooded the pool with not-AI before.
    if (wantAi && !haveOpenai) {
      console.warn("[continuous] AI is underrepresented but OPENAI_API_KEY is missing — skipping (not adding a real photo, to avoid worsening the imbalance)");
      continue;
    }
    try {
      if (wantAi) {
        const category = SEED_CATEGORIES[Math.floor(Math.random() * SEED_CATEGORIES.length)]!;
        const tag = slugify(category.replace(/ photography$/, ""));
        await createAiVariant(client, { category, tags: [tag], seed: Date.now() + i });
        ai++;
      } else {
        await createRealPhoto(client);
        real++;
      }
    } catch (err) {
      // Best-effort: a single failure (e.g. OpenAI hiccup) shouldn't abort the batch.
      console.error(`[continuous] item ${i + 1} failed: ${(err as Error).message}`);
    }
  }
  return { ai, real };
}
