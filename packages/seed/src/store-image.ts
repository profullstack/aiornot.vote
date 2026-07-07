import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { seedStorageConfigured, seedUpload } from "./storage";
import { mediaStorageDir } from "./media-dir";

/** Compress a large source image to a web-friendly WebP (bounded size, small bytes). */
async function toWebp(buf: Buffer): Promise<Buffer> {
  try {
    return await sharp(buf)
      .resize(1024, 1280, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return buf; // if sharp is unavailable, store the original
  }
}

/**
 * Persist a generated image and return a URL the web app can serve.
 * Images are compressed to WebP first (raw model output is multi-MB PNG).
 * - Object storage (R2/S3) configured → upload there, return absolute URL.
 * - Otherwise → write under MEDIA_STORAGE_DIR, return a relative `/media/...` URL
 *   served by the web app's `/media/[...path]` route.
 */
export async function storeImage(
  key: string,
  buf: Buffer,
  _contentType: string,
): Promise<string> {
  const webp = await toWebp(buf);
  const webpKey = key.replace(/\.(png|jpg|jpeg)$/i, ".webp");

  if (seedStorageConfigured()) {
    return seedUpload(webpKey, webp, "image/webp");
  }
  const full = join(mediaStorageDir(), webpKey);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, webp);
  return `/media/${webpKey}`;
}
