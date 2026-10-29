import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { disconnectCoinPay } from "@/lib/coinpay-signin";

export const runtime = "nodejs";

/** POST /api/v1/coinpay/disconnect: refused while CoinPay is the only way in. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const result = await disconnectCoinPay(sqlClient, user.id);
  if (result === "only_way_in") {
    return NextResponse.json(
      { ok: false, error: "CoinPay is the only way into this account, so it cannot be disconnected." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
