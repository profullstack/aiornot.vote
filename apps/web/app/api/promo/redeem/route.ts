import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { redeemPromo } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Verify your email first." }, { status: 403 });
  }
  if (!rateLimit(`promo:${user.id}`, 8, 5 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "");
  const result = await redeemPromo(user.id, code);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
