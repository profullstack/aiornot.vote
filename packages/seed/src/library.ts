import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import sharp from "sharp";
import { getClient, newId } from "@aiornot/db";
import type { Client } from "@libsql/client";
import { mediaStorageDir } from "./media-dir";
import { seedStorageConfigured, seedUpload } from "./storage";

/**
 * Where library originals live. Never under MEDIA_STORAGE_DIR: the `/media`
 * route serves that tree to anyone, and the originals are what the pass buys.
 * In production MEDIA_STORAGE_DIR=/data/media, so this is /data/.library-originals.
 */
export function libraryOriginalsDir(): string {
  return process.env.LIBRARY_STORAGE_DIR || resolve(mediaStorageDir(), "..", ".library-originals");
}

/** Absolute path of an original from its stored key, refusing traversal. */
export function libraryOriginalPath(key: string): string | null {
  const base = resolve(libraryOriginalsDir());
  const target = resolve(base, key);
  return target.startsWith(base + "/") ? target : null;
}

const PREVIEW_MAX = 960;

/** A bounded WebP preview with a faint repeating wordmark, so it is not the product. */
async function previewWebp(buf: Buffer): Promise<{ data: Buffer; width: number; height: number }> {
  const resized = sharp(buf).rotate().resize(PREVIEW_MAX, PREVIEW_MAX, { fit: "inside", withoutEnlargement: true });
  const { data: raw, info } = await resized.toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const step = 220;
  let marks = "";
  for (let y = 40; y < h + step; y += step) {
    for (let x = (y / step) % 2 ? -60 : 40; x < w + step; x += step * 1.6) {
      marks += `<text x="${x}" y="${y}" transform="rotate(-24 ${x} ${y})">aiornot.vote</text>`;
    }
  }
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<g font-family="sans-serif" font-size="26" font-weight="700" fill="#fff" fill-opacity="0.22" ` +
      `stroke="#000" stroke-opacity="0.12" stroke-width="1">${marks}</g></svg>`,
  );
  const data = await sharp(raw).composite([{ input: svg }]).webp({ quality: 78 }).toBuffer();
  return { data, width: w, height: h };
}

export type StoredLibraryFile = {
  previewUrl: string;
  originalKey: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  fileSizeBytes: number;
};

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/tiff": "tif",
};

/**
 * Save an untouched original privately and return its key.
 * `keyPrefix` groups originals on disk (e.g. "met", "contrib/<userId>").
 */
export async function writeLibraryOriginal(buf: Buffer, mimeType: string, keyPrefix: string): Promise<string> {
  const originalKey = `${keyPrefix}/${randomBytes(12).toString("hex")}.${MIME_EXT[mimeType] || "bin"}`;
  const full = libraryOriginalPath(originalKey);
  if (!full) throw new Error("Bad library key.");
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buf);
  return originalKey;
}

/** Keep the untouched original privately and publish a watermarked preview. */
export async function storeLibraryFile(buf: Buffer, mimeType: string, keyPrefix: string): Promise<StoredLibraryFile> {
  const key = await writeLibraryOriginal(buf, mimeType, keyPrefix);
  return publishLibraryFile(buf, mimeType, key);
}

/** Describe an original already on disk (`buf` is its bytes) and publish its watermarked preview. */
export async function publishLibraryFile(
  buf: Buffer,
  mimeType: string,
  originalKey: string,
): Promise<StoredLibraryFile> {
  const meta = await sharp(buf).metadata();
  const preview = await previewWebp(buf);
  const previewKey = `library/${randomBytes(12).toString("hex")}.webp`;
  let previewUrl: string;
  if (seedStorageConfigured()) {
    previewUrl = await seedUpload(previewKey, preview.data, "image/webp");
  } else {
    const p = join(mediaStorageDir(), previewKey);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, preview.data);
    previewUrl = `/media/${previewKey}`;
  }
  // EXIF orientation 5-8 swaps the axes.
  const swap = (meta.orientation ?? 1) >= 5;
  return {
    previewUrl,
    originalKey,
    mimeType,
    width: (swap ? meta.height : meta.width) ?? null,
    height: (swap ? meta.width : meta.height) ?? null,
    fileSizeBytes: buf.length,
  };
}

function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
    "photo"
  );
}

export async function uniqueLibrarySlug(client: Client, title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 40; i++) {
    const cand = i === 0 ? base : `${base}-${i + 1}`;
    const r = await client.execute({ sql: "SELECT 1 FROM library_photos WHERE slug = ? LIMIT 1", args: [cand] });
    if (r.rows.length === 0) return cand;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export type LibraryInsert = {
  title: string;
  description?: string | null;
  photographer?: string | null;
  photoDate?: string | null;
  creditUrl?: string | null;
  source: "contributor" | "met";
  sourceId?: string | null;
  license: "contributor" | "cc0";
  contributorUserId?: string | null;
  mediaId?: string | null;
  tags?: string[];
  file: StoredLibraryFile;
};

export async function insertLibraryPhoto(client: Client, p: LibraryInsert): Promise<{ id: string; slug: string }> {
  const id = newId("lib");
  const slug = await uniqueLibrarySlug(client, p.title);
  await client.execute({
    sql: `INSERT INTO library_photos
      (id, slug, title, description, photographer, photo_date, credit_url, source, source_id, license,
       contributor_user_id, media_id, preview_url, original_key, mime_type, width, height, file_size_bytes, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id, slug, p.title.slice(0, 160), p.description ?? null, p.photographer ?? null, p.photoDate ?? null,
      p.creditUrl ?? null, p.source, p.sourceId ?? null, p.license, p.contributorUserId ?? null,
      p.mediaId ?? null, p.file.previewUrl, p.file.originalKey, p.file.mimeType, p.file.width,
      p.file.height, p.file.fileSizeBytes, (p.tags ?? []).join(","),
    ],
  });
  return { id, slug };
}

// ---- The Met Open Access (CC0) ----------------------------------------------

const MET = "https://collectionapi.metmuseum.org/public/collection";
const MET_PHOTOGRAPHS_DEPT = 19;
const MET_MAX_BYTES = 30 * 1024 * 1024;

type MetObject = {
  objectID: number;
  isPublicDomain: boolean;
  primaryImage: string;
  title: string;
  artistDisplayName: string;
  objectDate: string;
  objectURL: string;
  medium: string;
  creditLine: string;
  tags: Array<{ term: string }> | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function metJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "aiornot.vote library import (hello@aiornot.vote)" } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 404) return null;
    await sleep(1000 * 2 ** attempt);
  }
  return null;
}

/** Met titles bracket descriptive (untitled) names: "[Young Woman with ...]". */
export function cleanMetTitle(title: string): string {
  const t = title.replace(/^\[(.*)\]$/, "$1").replace(/\s+/g, " ").trim();
  return t || "Untitled photograph";
}

/**
 * Import public-domain photographs from The Met's Photographs department.
 * Only objects The Met marks isPublicDomain (released CC0) with a primary image.
 * Samples random search pages so one run is not a single photographer's series.
 */
export async function importMetPhotos(opts: { count: number; client?: Client; log?: (s: string) => void }) {
  const client = opts.client ?? getClient();
  const log = opts.log ?? (() => {});
  const seen = new Set<string>();
  let imported = 0;
  let pages = 0;

  while (imported < opts.count && pages < 40) {
    pages++;
    const offset = Math.floor(Math.random() * 19) * 500; // the search window ends at 10,000
    const page = await metJson<{ objectIDs: number[] | null }>(
      `${MET}/v1.1/search?departmentId=${MET_PHOTOGRAPHS_DEPT}&isPublicDomain=true&hasImages=true&q=*&limit=500&offset=${offset}`,
    );
    const idsOnPage = [...(page?.objectIDs ?? [])].sort(() => Math.random() - 0.5).slice(0, 60);
    for (const objectId of idsOnPage) {
      if (imported >= opts.count) break;
      const sourceId = String(objectId);
      if (seen.has(sourceId)) continue;
      seen.add(sourceId);
      const dupe = await client.execute({
        sql: "SELECT 1 FROM library_photos WHERE source = 'met' AND source_id = ? LIMIT 1",
        args: [sourceId],
      });
      if (dupe.rows.length) continue;

      const o = await metJson<MetObject>(`${MET}/v1/objects/${objectId}`);
      if (!o?.isPublicDomain || !o.primaryImage) continue;
      try {
        const res = await fetch(o.primaryImage);
        if (!res.ok) continue;
        const type = (res.headers.get("content-type") || "image/jpeg").split(";")[0]!.trim();
        if (!type.startsWith("image/")) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MET_MAX_BYTES) continue;
        const file = await storeLibraryFile(buf, type, "met");
        const desc = [o.medium, o.creditLine && `The Metropolitan Museum of Art, ${o.creditLine}`]
          .filter(Boolean)
          .join(". ");
        await insertLibraryPhoto(client, {
          title: cleanMetTitle(o.title),
          description: desc || null,
          photographer: o.artistDisplayName || null,
          photoDate: o.objectDate || null,
          creditUrl: o.objectURL || null,
          source: "met",
          sourceId,
          license: "cc0",
          tags: ["archive", ...(o.tags ?? []).map((t) => slugify(t.term))].slice(0, 10),
          file,
        });
        imported++;
        log(`  + ${cleanMetTitle(o.title).slice(0, 70)} (${imported}/${opts.count})`);
      } catch (err) {
        log(`  ! ${objectId}: ${(err as Error).message}`);
      }
      await sleep(150); // well under The Met's 80 requests per second
    }
  }
  return { imported };
}
