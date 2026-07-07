import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import type { ScrapedPost } from "./scrape";

const PLATFORM_LABEL: Record<string, string> = {
  reddit: "Reddit", x: "X", bluesky: "Bluesky", nostr: "Nostr", mastodon: "Mastodon", web: "the web",
};

function platformLabel(p: string): string {
  return PLATFORM_LABEL[p] ?? p;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "post";
}

async function uniqueSlug(base: string): Promise<string> {
  const b = slugify(base);
  for (let i = 0; i < 50; i++) {
    const cand = i === 0 ? b : `${b}-${i + 1}`;
    const r = await sqlClient.execute({ sql: "SELECT 1 FROM media WHERE slug = ? LIMIT 1", args: [cand] });
    if (r.rows.length === 0) return cand;
  }
  return `${b}-${Date.now().toString(36)}`;
}

async function ensureTag(rawSlug: string): Promise<string | null> {
  const s = slugify(rawSlug);
  if (!s) return null;
  const ex = await sqlClient.execute({ sql: "SELECT id FROM tags WHERE slug = ? LIMIT 1", args: [s] });
  if (ex.rows[0]) return ex.rows[0].id as string;
  await sqlClient.execute({
    sql: "INSERT OR IGNORE INTO tags (id, slug, name, is_visible) VALUES (?, ?, ?, 1)",
    args: [newId("tag"), s, s],
  });
  const again = await sqlClient.execute({ sql: "SELECT id FROM tags WHERE slug = ? LIMIT 1", args: [s] });
  return (again.rows[0]?.id as string) ?? null;
}

export type CreateLinkResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Turn a scraped post into a crowd-verdict media item. Truth is 'unknown' (the
 * crowd decides), so these never affect scoring/streaks. Auto-approved — the
 * $1 play pass is the anti-spam gate.
 */
export async function createLinkPost(userId: string, scrape: ScrapedPost): Promise<CreateLinkResult> {
  const dup = await sqlClient.execute({ sql: "SELECT slug FROM media WHERE source_url = ? LIMIT 1", args: [scrape.sourceUrl] });
  if (dup.rows[0]) return { ok: false, error: "That link has already been submitted." };

  const title =
    scrape.title?.trim() ||
    (scrape.author ? `${scrape.author} on ${platformLabel(scrape.platform)}` : `A post from ${platformLabel(scrape.platform)}`);

  const id = newId("med");
  const slug = await uniqueSlug(title);
  await sqlClient.execute({
    sql: `INSERT INTO media
      (id, slug, media_type, title, description, media_url, source_url, source_domain, source_provider,
       submitter_user_id, submitter_claim, seed_source, truth_label, truth_confidence, reveal_status,
       status, is_score_eligible, approved_at)
      VALUES (?, ?, 'link', ?, ?, ?, ?, ?, 'url', ?, 'unknown', 'user_upload', 'unknown', 'unverified',
              'revealed', 'approved', 0, CURRENT_TIMESTAMP)`,
    args: [id, slug, title.slice(0, 200), scrape.body, scrape.sourceUrl, scrape.sourceUrl, scrape.sourceDomain, userId],
  });
  await sqlClient.execute({ sql: "INSERT OR IGNORE INTO media_stats (media_id) VALUES (?)", args: [id] });

  for (const t of new Set([...scrape.tags, scrape.platform, "post"].filter(Boolean))) {
    const tid = await ensureTag(t);
    if (tid) await sqlClient.execute({ sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)", args: [id, tid] });
  }
  return { ok: true, slug };
}
