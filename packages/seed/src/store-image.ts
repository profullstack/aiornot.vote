import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { seedStorageConfigured, seedUpload } from "./storage";
import { mediaStorageDir } from "./media-dir";

/**
 * Persist a generated image and return a URL the web app can serve.
 * - If object storage (R2/S3) is configured → upload there, return absolute URL.
 * - Otherwise → write under MEDIA_STORAGE_DIR and return a relative `/media/...`
 *   URL served by the web app's `/media/[...path]` route (works in dev and,
 *   with MEDIA_STORAGE_DIR on a volume, in production).
 */
export async function storeImage(
  key: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  if (seedStorageConfigured()) {
    const { publicUrl } = await seedUploadCompat(key, buf, contentType);
    return publicUrl;
  }
  const full = join(mediaStorageDir(), key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, buf);
  return `/media/${key}`;
}

// seedUpload returns a string URL; normalise to an object for future-proofing.
async function seedUploadCompat(key: string, buf: Buffer, contentType: string) {
  const url = await seedUpload(key, buf, contentType);
  return { publicUrl: url };
}
