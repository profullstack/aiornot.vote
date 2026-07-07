import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sqlClient } from "@/lib/db";
import { getCoinpayPayment, isPaymentPaid } from "@/lib/coinpay";
import { grantForPayment } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";

  const res = await sqlClient.execute({
    sql: "SELECT id, user_id, purpose, status, coinpay_payment_id FROM payments WHERE id = ? LIMIT 1",
    args: [id],
  });
  const p = res.rows[0];
  if (!p || p.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Payment not found." }, { status: 404 });
  }
  if (p.status === "granted") {
    return NextResponse.json({ ok: true, status: "granted", purpose: p.purpose });
  }

  const cp = await getCoinpayPayment(p.coinpay_payment_id as string);
  if (!cp) {
    return NextResponse.json({ ok: true, status: "pending" });
  }
  if (!isPaymentPaid(cp.status)) {
    // Reflect intermediate CoinPay states (pending/detected/…).
    await sqlClient.execute({
      sql: "UPDATE payments SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [id],
    });
    return NextResponse.json({ ok: true, status: cp.status || "pending" });
  }

  // Paid — grant once. Atomically flip pending → granted so concurrent polls
  // don't double-grant.
  const flip = await sqlClient.execute({
    sql: "UPDATE payments SET status = 'granted', granted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'granted'",
    args: [id],
  });
  if (flip.rowsAffected === 0) {
    return NextResponse.json({ ok: true, status: "granted", purpose: p.purpose });
  }
  const grant = await grantForPayment({
    id: id,
    userId: user.id,
    purpose: p.purpose as string,
  });
  return NextResponse.json({
    ok: true,
    status: "granted",
    purpose: p.purpose,
    apiKey: grant.apiKeyPlaintext, // shown exactly once
  });
}
