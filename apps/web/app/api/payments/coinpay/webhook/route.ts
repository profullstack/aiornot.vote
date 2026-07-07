import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { verifyWebhookSignature, isPaymentPaid } from "@/lib/coinpay";

export const runtime = "nodejs";

/**
 * CoinPay webhook. Verifies the X-CoinPay-Signature and, on a paid event, marks
 * the matching payment 'confirmed' so the next status poll grants it quickly.
 * The actual entitlement (API key reveal / membership) is granted in the status
 * route, which has the user's session. Configure COINPAY_WEBHOOK_SECRET +
 * webhook URL in the CoinPay dashboard to enable this fast path (polling works
 * regardless).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhookSignature(req.headers.get("x-coinpay-signature"), raw)) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }
  let evt: { type?: string; data?: { id?: string; status?: string; metadata?: Record<string, unknown> } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const data = evt.data || {};
  const paid = isPaymentPaid(data.status) || evt.type === "payment.confirmed" || evt.type === "payment.forwarded";
  const ref = (data.metadata?.payment_ref as string) || null;
  const coinpayId = data.id || null;

  if (paid && (ref || coinpayId)) {
    await sqlClient.execute({
      sql: `UPDATE payments SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE (id = ? OR coinpay_payment_id = ?) AND status = 'pending'`,
      args: [ref, coinpayId],
    });
  }
  return NextResponse.json({ ok: true });
}
