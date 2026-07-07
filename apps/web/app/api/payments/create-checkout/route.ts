import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { newId } from "@aiornot/db";
import { sqlClient } from "@/lib/db";
import { createCoinpayPayment } from "@/lib/coinpay";
import { quotePromo, grantPurpose, recordPromoRedemption } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PURPOSES: Record<string, { amount: () => number; label: string }> = {
  api_access: { amount: () => env.priceApiAccessUsd, label: "AIorNot.vote API access" },
  lifetime_membership: { amount: () => env.priceLifetimeUsd, label: "AIorNot.vote lifetime membership" },
  play_pass: { amount: () => env.pricePlayPassUsd, label: "AIorNot.vote play pass" },
};

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!env.coinpayConfigured) {
    return NextResponse.json({ ok: false, error: "Payments are not configured." }, { status: 400 });
  }
  if (!rateLimit(`checkout:${user.id}`, 10, 5 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const purpose = String(body.purpose || "");
  const blockchain = String(body.blockchain || "SOL").toUpperCase();
  const spec = PURPOSES[purpose];
  if (!spec) return NextResponse.json({ ok: false, error: "Unknown purpose." }, { status: 400 });

  if (purpose === "lifetime_membership" && user.isMember) {
    return NextResponse.json({ ok: false, error: "You're already a lifetime member." }, { status: 400 });
  }
  if (purpose === "play_pass" && user.canPlay) {
    return NextResponse.json({ ok: false, error: "You already have play access." }, { status: 400 });
  }

  // Optional promo code — validate + compute the discounted price.
  const promoRaw = String(body.promoCode || "").trim();
  let finalUsd = spec.amount();
  let promoCode: string | null = null;
  let percentOff = 0;
  if (promoRaw) {
    const quote = await quotePromo(user.id, promoRaw, purpose, spec.amount());
    if (!quote.ok) return NextResponse.json({ ok: false, error: quote.error }, { status: 400 });
    finalUsd = quote.finalUsd;
    promoCode = quote.code;
    percentOff = quote.percentOff;

    // 100% off (free comp): grant immediately, no crypto payment needed.
    if (quote.free) {
      const paymentId = newId("pay");
      const grant = await grantPurpose(user.id, purpose);
      await recordPromoRedemption(quote.code, user.id);
      await sqlClient.execute({
        sql: `INSERT INTO payments (id, user_id, purpose, amount_usd, status, promo_code, granted_at)
              VALUES (?, ?, ?, 0, 'granted', ?, CURRENT_TIMESTAMP)`,
        args: [paymentId, user.id, purpose, quote.code],
      });
      return NextResponse.json({ ok: true, granted: true, purpose, percentOff, apiKey: grant.apiKeyPlaintext ?? null });
    }
  }

  const paymentId = newId("pay");
  const created = await createCoinpayPayment({
    amountUsd: finalUsd,
    blockchain,
    description: percentOff > 0 ? `${spec.label} (${percentOff}% off)` : spec.label,
    metadata: { user_id: user.id, purpose, payment_ref: paymentId, app: "aiornot.vote" },
  });
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 502 });
  }
  const p = created.payment;

  await sqlClient.execute({
    sql: `INSERT INTO payments (id, user_id, purpose, amount_usd, blockchain, coinpay_payment_id, payment_address, crypto_amount, status, promo_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [paymentId, user.id, purpose, finalUsd, blockchain, p.id, p.payment_address ?? null, p.crypto_amount ?? null, promoCode],
  });

  return NextResponse.json({ ok: true, paymentId, finalUsd, percentOff });
}
