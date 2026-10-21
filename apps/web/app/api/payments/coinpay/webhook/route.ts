import { NextResponse } from "next/server";
import { verifyCoinPayWebhook } from "@profullstack/stack/coinpay";
import { env } from "@/lib/env";
import { settleCoinpayWebhook, type CoinpayWebhookEvent } from "@/lib/coinpay-webhook";

export const runtime = "nodejs";

/**
 * CoinPay webhook. Verifies `X-CoinPay-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256
 * of `${t}.${rawBody}`, 300s tolerance) over the raw body, then settles the
 * nested payload: prize sponsorships are activated, membership / play pass are
 * granted, API access is confirmed for its one-time reveal on the status poll.
 * Unknown or non-paid events answer 200 so CoinPay stops retrying.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyCoinPayWebhook({
    signature: req.headers.get("x-coinpay-signature"),
    rawBody: raw,
    secret: env.coinpay.webhookSecret,
  })) {
    return NextResponse.json({ ok: false, error: "Invalid signature." }, { status: 401 });
  }
  let evt: CoinpayWebhookEvent;
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  try {
    const outcome = await settleCoinpayWebhook(evt);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    // A 5xx makes CoinPay retry, which is what we want for a transient DB error.
    console.error("[coinpay webhook] settle failed", error);
    return NextResponse.json({ ok: false, error: "settle failed" }, { status: 500 });
  }
}
