import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { readBoundedInteger } from "@/lib/bounded-integer";
import { importUnsplashBatch } from "@aiornot/seed";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    return NextResponse.json(
      { ok: false, error: "UNSPLASH_ACCESS_KEY is not configured. Run the worker seed instead." },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const query = String(body.query || "portrait photography");
  const count = readBoundedInteger(body.count, { fallback: 10, min: 1, max: 30 });
  try {
    const result = await importUnsplashBatch({ query, count, orientation: "portrait" });
    await audit(auth.user.id, "seed.unsplash", "seed_batch", result.batchId, { query, count });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
