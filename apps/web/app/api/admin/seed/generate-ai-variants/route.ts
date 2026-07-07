import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { generateAiVariantsBatch } from "@aiornot/seed";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY is not configured. Run the worker seed instead." },
      { status: 400 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const count = Math.min(10, Math.max(1, Number(body.count) || 5));
  try {
    const result = await generateAiVariantsBatch({ count });
    await audit(auth.user.id, "seed.ai-variants", "seed_batch", result.batchId, { count });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
