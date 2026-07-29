import { sqlClient } from "./db";

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      // Strip a leading separator first, then truncate, then strip any
      // trailing separator. Trimming before slicing meant a 60-char cut could
      // fall right after a "-" and re-introduce a trailing separator.
      .replace(/^-+/, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "media"
  );
}

/** Slug that is unique within the media table. */
export async function uniqueMediaSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const res = await sqlClient.execute({
      sql: "SELECT 1 FROM media WHERE slug = ? LIMIT 1",
      args: [candidate],
    });
    if (res.rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
