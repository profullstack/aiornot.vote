import { NextResponse } from "next/server";
import { requestUser } from "@/lib/request-user";
import { redeemCode, LIBRARY_DAYS_UNIT } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/credits/redeem { code } — redeem a credit code for days of the
 * photo library pass. Session cookie or `Authorization: Bearer aion_...`.
 * 200 { ok, unit: "library_days", days, libraryPassUntil };
 * 400 { ok: false, reason: invalid|expired|used_up|already_redeemed|revoked, error }.
 */
export async function POST(req: Request) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to redeem a code." }, { status: 401 });
  if (!(await rateLimit(`redeem:${user.id}`, 10, 60_000)).ok) {
    return NextResponse.json({ ok: false, error: "Too many tries. Wait a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const r = await redeemCode(user.id, body.code);
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, reason: r.reason, error: r.error },
      { status: r.reason === "grant_failed" ? 500 : 400 },
    );
  }
  return NextResponse.json({ ok: true, unit: LIBRARY_DAYS_UNIT, days: r.days, libraryPassUntil: r.until });
}
