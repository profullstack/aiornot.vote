import "server-only";
import { sqlClient } from "./db";
import { ids } from "@aiornot/db";
import { uniqueMediaSlug } from "./slug";
import { domainOf } from "./url-guard";

export type CreateMediaInput = {
  title: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  storageKey?: string | null;
  originalUrl?: string | null;
  sourceUrl?: string | null;
  sourceProvider?: "upload" | "url" | "unsplash" | "openai" | "admin";
  seedSource?: "unsplash" | "openai" | "manual" | "user_upload";
  submitterUserId?: string | null;
  submitterClaim?: "ai" | "not_ai" | "unknown" | null;
  truthLabel?: "ai" | "not_ai" | "unknown";
  truthConfidence?: "seeded" | "admin_verified" | "user_claim" | "unverified";
  status?: "pending" | "approved" | "rejected" | "hidden" | "needs_review";
  isFeatured?: boolean;
  aiPromptSummary?: string | null;
  aiModel?: string | null;
  sourceParentMediaId?: string | null;
  tagSlugs?: string[];
};

/** Insert a media row (+ tags + empty stats). Returns the new media id/slug. */
export async function createMedia(input: CreateMediaInput): Promise<{ id: string; slug: string }> {
  const id = ids.media();
  const slug = await uniqueMediaSlug(input.title);
  const status = input.status ?? "pending";

  await sqlClient.execute({
    sql: `INSERT INTO media
      (id, slug, media_type, title, media_url, thumbnail_url, poster_url, storage_key,
       original_url, source_url, source_domain, source_provider, seed_source,
       source_parent_media_id, submitter_user_id, submitter_claim, truth_label,
       truth_confidence, reveal_status, status, is_featured, ai_prompt_summary, ai_model, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hidden_until_guess', ?, ?, ?, ?, ?)`,
    args: [
      id,
      slug,
      input.mediaType,
      input.title,
      input.mediaUrl,
      input.thumbnailUrl ?? null,
      input.posterUrl ?? null,
      input.storageKey ?? null,
      input.originalUrl ?? null,
      input.sourceUrl ?? null,
      domainOf(input.sourceUrl),
      input.sourceProvider ?? "url",
      input.seedSource ?? null,
      input.sourceParentMediaId ?? null,
      input.submitterUserId ?? null,
      input.submitterClaim ?? null,
      input.truthLabel ?? "unknown",
      input.truthConfidence ?? "unverified",
      status,
      input.isFeatured ? 1 : 0,
      input.aiPromptSummary ?? null,
      input.aiModel ?? null,
      status === "approved" ? new Date().toISOString() : null,
    ],
  });

  await sqlClient.execute({
    sql: "INSERT OR IGNORE INTO media_stats (media_id) VALUES (?)",
    args: [id],
  });

  const tagSlugs = new Set(input.tagSlugs ?? []);
  tagSlugs.add(input.mediaType); // 'image' or 'video' tag
  for (const ts of tagSlugs) {
    const t = await sqlClient.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [ts] });
    const tagId = t.rows[0]?.id as string | undefined;
    if (tagId) {
      await sqlClient.execute({
        sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) VALUES (?, ?)",
        args: [id, tagId],
      });
    }
  }

  return { id, slug };
}
