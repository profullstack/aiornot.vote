import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, keys: await listApiKeys(user.id) });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  // Lifetime members can mint keys for free; everyone else buys API access ($1).
  if (!user.isMember) {
    return NextResponse.json(
      { ok: false, error: "Buy API access ($1) or become a lifetime member to create keys." },
      { status: 402 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const created = await createApiKey(user.id, String(body.label || "API key"));
  return NextResponse.json({ ok: true, apiKey: created.plaintext, prefix: created.prefix });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
  await revokeApiKey(user.id, id);
  return NextResponse.json({ ok: true });
}
