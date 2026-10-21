import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";

export type LibrarySource = "contributor" | "met";

export type LibraryPhoto = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  photographer: string | null;
  photoDate: string | null;
  creditUrl: string | null;
  source: LibrarySource;
  license: "contributor" | "cc0";
  previewUrl: string;
  originalKey: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  tags: string[];
  downloadCount: number;
  createdAt: string;
  /** Crowd votes from the game, for contributor photos that went through it. */
  votes: { human: number; total: number } | null;
};

const COLS = `p.id, p.slug, p.title, p.description, p.photographer, p.photo_date, p.credit_url, p.source,
  p.license, p.preview_url, p.original_key, p.mime_type, p.width, p.height, p.file_size_bytes, p.tags,
  p.download_count, p.created_at, s.not_ai_guesses, s.total_guesses`;

function toPhoto(r: Record<string, unknown>): LibraryPhoto {
  const total = Number(r.total_guesses ?? 0);
  return {
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    photographer: (r.photographer as string) ?? null,
    photoDate: (r.photo_date as string) ?? null,
    creditUrl: (r.credit_url as string) ?? null,
    source: r.source as LibrarySource,
    license: r.license as "contributor" | "cc0",
    previewUrl: r.preview_url as string,
    originalKey: r.original_key as string,
    mimeType: (r.mime_type as string) ?? null,
    width: r.width == null ? null : Number(r.width),
    height: r.height == null ? null : Number(r.height),
    fileSizeBytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    tags: String(r.tags ?? "").split(",").filter(Boolean),
    downloadCount: Number(r.download_count ?? 0),
    createdAt: String(r.created_at ?? ""),
    votes: total > 0 ? { human: Number(r.not_ai_guesses ?? 0), total } : null,
  };
}

/** Escape LIKE wildcards in user input; the pattern uses `\` as its escape. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export async function listLibrary(opts: {
  q?: string;
  source?: LibrarySource | null;
  page: number;
  pageSize: number;
}): Promise<{ photos: LibraryPhoto[]; total: number }> {
  const where = ["p.status = 'listed'"];
  const args: (string | number)[] = [];
  const q = opts.q?.trim().slice(0, 80);
  if (q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.photographer LIKE ? ESCAPE '\\' OR p.tags LIKE ? ESCAPE '\\')");
    const pat = likePattern(q);
    args.push(pat, pat, pat);
  }
  if (opts.source) {
    where.push("p.source = ?");
    args.push(opts.source);
  }
  const whereSql = where.join(" AND ");
  const count = await sqlClient.execute({ sql: `SELECT COUNT(*) AS n FROM library_photos p WHERE ${whereSql}`, args });
  const rows = await sqlClient.execute({
    // Contributor photos (modern, crowd-checked) lead; the archive follows.
    sql: `SELECT ${COLS} FROM library_photos p LEFT JOIN media_stats s ON s.media_id = p.media_id
          WHERE ${whereSql}
          ORDER BY CASE WHEN p.source = 'contributor' THEN 0 ELSE 1 END, p.created_at DESC, p.id
          LIMIT ? OFFSET ?`,
    args: [...args, opts.pageSize, (Math.max(1, opts.page) - 1) * opts.pageSize],
  });
  return { photos: rows.rows.map((r) => toPhoto(r as Record<string, unknown>)), total: Number(count.rows[0]?.n ?? 0) };
}

export async function getLibraryPhoto(by: { slug?: string; id?: string }): Promise<LibraryPhoto | null> {
  const col = by.id ? "p.id" : "p.slug";
  const r = await sqlClient.execute({
    sql: `SELECT ${COLS} FROM library_photos p LEFT JOIN media_stats s ON s.media_id = p.media_id
          WHERE ${col} = ? AND p.status = 'listed' LIMIT 1`,
    args: [by.id ?? by.slug ?? ""],
  });
  return r.rows[0] ? toPhoto(r.rows[0] as Record<string, unknown>) : null;
}

export async function libraryStats(): Promise<{ total: number; contributor: number; met: number }> {
  const r = await sqlClient.execute(
    "SELECT source, COUNT(*) AS n FROM library_photos WHERE status = 'listed' GROUP BY source",
  );
  const by = Object.fromEntries(r.rows.map((x) => [x.source as string, Number(x.n)]));
  const contributor = by.contributor ?? 0;
  const met = by.met ?? 0;
  return { total: contributor + met, contributor, met };
}

/** Downloads this account took since `sinceIso` (the daily cap). */
export async function downloadsSince(userId: string, sinceIso: string): Promise<number> {
  const r = await sqlClient.execute({
    sql: "SELECT COUNT(*) AS n FROM library_downloads WHERE user_id = ? AND created_at > ?",
    args: [userId, sinceIso],
  });
  return Number(r.rows[0]?.n ?? 0);
}

export async function recordDownload(userId: string, photoId: string): Promise<void> {
  await sqlClient.execute({
    sql: "INSERT INTO library_downloads (id, user_id, photo_id, created_at) VALUES (?, ?, ?, ?)",
    args: [newId("dl"), userId, photoId, new Date().toISOString()],
  });
  await sqlClient.execute({
    sql: "UPDATE library_photos SET download_count = download_count + 1 WHERE id = ?",
    args: [photoId],
  });
}

export function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
