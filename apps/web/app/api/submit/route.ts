import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { sqlClient } from "@/lib/db";
import { ids } from "@aiornot/db";
import { validateExternalUrl } from "@/lib/url-guard";
import { storageConfigured, uploadObject } from "@/lib/storage";
import { createMedia } from "@/lib/media-create";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to submit." }, { status: 401 });
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Verify your email before submitting." }, { status: 403 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`submit:${user.id}:${hashIp(ip)}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Try again later." }, { status: 429 });
  }

  const form = await req.formData();
  const title = String(form.get("title") || "").trim();
  const externalUrl = String(form.get("mediaUrl") || "").trim();
  const sourceUrl = String(form.get("sourceUrl") || "").trim();
  const claim = String(form.get("claim") || "unknown");
  const tagsRaw = String(form.get("tags") || "");
  const file = form.get("file");
  const submitterClaim = (["ai", "not_ai", "unknown"].includes(claim) ? claim : "unknown") as
    | "ai" | "not_ai" | "unknown";
  const tagSlugs = tagsRaw
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, ""))
    .filter(Boolean)
    .slice(0, 8);

  if (!title) return NextResponse.json({ ok: false, error: "A title is required." }, { status: 400 });

  let mediaUrl = "";
  let storageKey: string | null = null;
  let mediaType: "image" | "video" = "image";
  let originalUrl: string | null = null;

  if (file && typeof file !== "string" && file.size > 0) {
    const type = file.type;
    const isImage = IMAGE_TYPES.has(type);
    const isVideo = VIDEO_TYPES.has(type);
    if (!isImage && !isVideo) {
      return NextResponse.json({ ok: false, error: "Unsupported file type." }, { status: 400 });
    }
    mediaType = isVideo ? "video" : "image";
    const maxBytes = (isVideo ? env.maxVideoUploadMb : env.maxImageUploadMb) * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { ok: false, error: `File too large (max ${isVideo ? env.maxVideoUploadMb : env.maxImageUploadMb}MB).` },
        { status: 400 },
      );
    }
    if (!storageConfigured()) {
      return NextResponse.json(
        { ok: false, error: "File uploads are not configured on this server. Submit an external media URL instead." },
        { status: 400 },
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const key = `uploads/${user.id}/${hash}.${EXT[type] || "bin"}`;
    const up = await uploadObject(key, buf, type);
    mediaUrl = up.publicUrl;
    storageKey = up.storageKey;
  } else if (externalUrl) {
    const v = validateExternalUrl(externalUrl);
    if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    mediaUrl = externalUrl;
    originalUrl = externalUrl;
    mediaType = /\.(mp4|webm|mov)(\?|$)/i.test(externalUrl) ? "video" : "image";
  } else {
    return NextResponse.json(
      { ok: false, error: "Provide a media file or an external media URL." },
      { status: 400 },
    );
  }

  if (sourceUrl) {
    const sv = validateExternalUrl(sourceUrl);
    if (!sv.ok) return NextResponse.json({ ok: false, error: `Source URL: ${sv.error}` }, { status: 400 });
  }

  // Record the submission for the moderation queue.
  await sqlClient.execute({
    sql: `INSERT INTO submissions (id, user_id, media_type, original_url, storage_key, title, source_url, suggested_tags, submitter_claim, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    args: [
      ids.submission(), user.id, mediaType, originalUrl, storageKey, title,
      sourceUrl || null, tagSlugs.join(","), submitterClaim,
    ],
  });

  // Create the pending media item (admin approves + sets truth label).
  const media = await createMedia({
    title,
    mediaType,
    mediaUrl,
    storageKey,
    originalUrl,
    sourceUrl: sourceUrl || null,
    sourceProvider: storageKey ? "upload" : "url",
    seedSource: "user_upload",
    submitterUserId: user.id,
    submitterClaim,
    truthLabel: "unknown",
    truthConfidence: "user_claim",
    status: "pending",
    tagSlugs,
  });

  return NextResponse.json({ ok: true, slug: media.slug });
}
