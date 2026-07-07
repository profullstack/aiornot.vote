import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/entitlements";
import { createMedia } from "@/lib/media-create";
import { validateExternalUrl } from "@/lib/url-guard";
import { rateLimit } from "@/lib/rate-limit";
import { sqlClient } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

function bearer(req: Request): string {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * POST /api/v1/opinions — submit an image for a crowd-sourced AI/not-AI opinion.
 * Auth: Authorization: Bearer <aion_live_…>. Body: { image_url, title?, tags?, metadata? }.
 */
export async function POST(req: Request) {
  const auth = await verifyApiKey(bearer(req));
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }
  if (!rateLimit(`v1:${auth.keyId}`, 60, 60_000).ok) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const imageUrl = String(body.image_url || body.imageUrl || "");
  const v = validateExternalUrl(imageUrl);
  if (!v.ok) return NextResponse.json({ error: `image_url: ${v.error}` }, { status: 400 });

  // Images only for now.
  if (/\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(imageUrl)) {
    return NextResponse.json({ error: "Only images are supported right now." }, { status: 400 });
  }

  const title = String(body.title || "Is this AI or real?").slice(0, 140);
  const tags: string[] = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/(^-|-$)/g, "")).filter(Boolean).slice(0, 8)
    : [];

  const media = await createMedia({
    title,
    mediaType: "image",
    mediaUrl: imageUrl,
    originalUrl: imageUrl,
    sourceUrl: imageUrl,
    sourceProvider: "url",
    seedSource: "user_upload",
    truthLabel: "unknown",
    truthConfidence: "unverified",
    // No hidden answer — this is a pure crowd opinion, votes are public.
    revealStatus: "revealed",
    status: "approved",
    createdViaApi: true,
    apiKeyId: auth.keyId,
    tagSlugs: tags,
  });

  return NextResponse.json(
    {
      id: media.id,
      slug: media.slug,
      url: `${env.appUrl}/m/${media.slug}`,
      results_url: `${env.appUrl}/api/v1/opinions/${media.id}`,
      status: "collecting",
      note: "Crowd opinion, not a scientific AI detector. Results accrue as verified users vote.",
    },
    { status: 201 },
  );
}

/** GET /api/v1/opinions — list opinions created with this API key. */
export async function GET(req: Request) {
  const auth = await verifyApiKey(bearer(req));
  if (!auth) return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  const res = await sqlClient.execute({
    sql: `SELECT id, slug, title, created_at FROM media WHERE api_key_id = ? ORDER BY created_at DESC LIMIT 100`,
    args: [auth.keyId],
  });
  return NextResponse.json({
    opinions: res.rows.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      url: `${env.appUrl}/m/${r.slug as string}`,
      results_url: `${env.appUrl}/api/v1/opinions/${r.id as string}`,
      created_at: r.created_at as string,
    })),
  });
}
