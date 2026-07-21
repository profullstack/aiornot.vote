import { randomUUID } from "node:crypto";
import { storeImage } from "./store-image";

/**
 * Shared, label-neutral pool that BOTH real and AI images are written into.
 * Nothing in the directory name hints at the truth label (unlike the old
 * `ai-variants/` path, which told a scraper "this side is the AI one").
 */
export const POOL_DIR = "pool";

/** A fresh, opaque object key inside the shared pool. No seed/label/source in it. */
export function poolKey(): string {
  return `${POOL_DIR}/${randomUUID()}.png`;
}

/**
 * Fetch a remote image server-side ONCE and persist it into our own media pool,
 * returning a URL served from our origin.
 *
 * Why: real photos were hotlinked straight from picsum.photos while AI photos
 * were served from /media/ai-variants, so the image SOURCE (host + path) leaked
 * the answer — a scraper or "view source" scored 100% without judging a pixel.
 * Copying the real image into the same local pool with an opaque filename makes
 * both sides origin-indistinguishable, and removes the runtime dependency on
 * picsum being reachable at play time. storeImage() re-encodes to WebP, which
 * also strips EXIF.
 */
export async function storeRemoteImage(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`storeRemoteImage: fetch ${url} failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  return storeImage(poolKey(), buf, "image/png");
}
