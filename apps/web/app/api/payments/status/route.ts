import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sqlClient } from "@/lib/db";
import { getCoinpayPayment, isPaymentPaid } from "@/lib/coinpay";
import { recordPromoRedemption } from "@/lib/entitlements";
import { grantPaymentInTransaction } from "@/lib/payment-grant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";

  const res = await sqlClient.execute({
    sql: "SELECT id, user_id, purpose, status, coinpay_payment_id, promo_code FROM payments WHERE id = ? LIMIT 1",
    args: [id],
  });
  const p = res.rows[0];
  if (!p || p.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Payment not found." }, { status: 404 });
  }
  if (p.status === "granted") {
    return NextResponse.json({ ok: true, status: "granted", purpose: p.purpose });
  }

  const alreadyConfirmed = p.status === "confirmed";
  if (!alreadyConfirmed) {
    const cp = await getCoinpayPayment(p.coinpay_payment_id as string);
    if (!cp) {
      return NextResponse.json({ ok: true, status: "pending" });
    }
    if (!isPaymentPaid(cp.status)) {
      // Reflect intermediate CoinPay states without downgrading a webhook-confirmed payment.
      await sqlClient.execute({
        sql: "UPDATE payments SET status = 'pending', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
        args: [id],
      });
      return NextResponse.json({ ok: true, status: cp.status || "pending" });
    }
  }

  // Paid — claim and grant in one write transaction. If entitlement delivery
  // fails, the status claim rolls back so a later poll can retry.
  const tx = await sqlClient.transaction("write");
  try {
    const grant = await grantPaymentInTransaction({
      tx,
      paymentId: id,
      userId: user.id,
      purpose: p.purpose as string,
    });
    tx.close();
    if (!grant) return NextResponse.json({ ok: true, status: "granted", purpose: p.purpose });
    // A discounted (non-free) promo payment records its redemption on grant.
    if (p.promo_code) await recordPromoRedemption(p.promo_code as string, user.id);
    return NextResponse.json({
      ok: true,
      status: "granted",
      purpose: p.purpose,
      apiKey: grant.apiKeyPlaintext, // shown exactly once
    });
  } catch (error) {
    // grantPaymentInTransaction owns rollback so the payment remains retryable.
    tx.close();
    console.error("Payment entitlement grant failed; leaving payment retryable", { id, error });
    return NextResponse.json(
      { ok: false, status: "confirmed", error: "Payment confirmed, but entitlement delivery failed. Retry the status check." },
      { status: 503 },
    );
  }
}
