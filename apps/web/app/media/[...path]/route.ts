import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { mediaStorageDir } from "@aiornot/seed";

export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Serves locally-stored media (used when object storage isn't configured). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const rel = (path || []).join("/");
  const base = resolve(mediaStorageDir());
  const target = resolve(base, rel);
  // Prevent path traversal outside the media dir.
  if (target !== base && !target.startsWith(base + "/")) {
    return new Response("Not found", { status: 404 });
  }
  if (!existsSync(target)) {
    return new Response("Not found", { status: 404 });
  }
  const data = await readFile(target);
  const type = TYPES[extname(target).toLowerCase()] || "application/octet-stream";
  return new Response(new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as unknown as BodyInit, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
