import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { drawWeeklyPrizes } from "@/lib/prizes";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const result = await drawWeeklyPrizes();
  await audit(auth.user.id, "prizes.draw", "prize_period", result.period.start, result);
  return NextResponse.json({ ok: true, ...result });
}
