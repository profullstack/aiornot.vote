import { sqlClient } from "./db";
import { isPaymentPaid } from "./coinpay";
import { activateSponsorship } from "./sponsorships";
import { recordPromoRedemption } from "./entitlements";
import { grantPaymentInTransaction } from "./payment-grant";

/**
 * CoinPay sends `{ id: "evt_<paymentId>_<ts>", type, data: { payment_id,
 * status, metadata, ... }, business_id }`. The top-level `id` is the EVENT, not
 * the payment, so the payment id comes from `data.payment_id` (falling back to
 * `data.id`, then the flat shape the older test sender used).
 */
export type CoinpayWebhookEvent = {
  type?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ParsedCoinpayWebhook = {
  type: string;
  paymentId: string | null;
  status: string;
  paid: boolean;
  metadata: Record<string, unknown>;
};

/** Event types that mean the money has landed. */
const PAID_TYPES = new Set(["payment.confirmed", "payment.forwarded"]);

export function parseCoinpayWebhook(evt: CoinpayWebhookEvent): ParsedCoinpayWebhook {
  const d = (evt.data && typeof evt.data === "object" ? evt.data : evt) as Record<string, unknown>;
  const rawId = d.payment_id ?? d.id ?? null;
  const paymentId = typeof rawId === "string" && rawId && !rawId.startsWith("evt_") ? rawId : null;
  const status = String(d.status ?? "").toLowerCase();
  const type = String(evt.type ?? "");
  const meta = (d.metadata ?? (evt as Record<string, unknown>).metadata ?? {}) as Record<string, unknown>;
  const failed = type === "payment.expired" || type === "payment.failed";
  return {
    type,
    paymentId,
    status,
    paid: !failed && (isPaymentPaid(status) || PAID_TYPES.has(type)),
    metadata: meta && typeof meta === "object" ? meta : {},
  };
}

export type WebhookOutcome =
  | { handled: false; reason: string }
  | { handled: true; kind: "sponsorship"; sponsorshipId: string; activated: boolean }
  | { handled: true; kind: "payment"; paymentRef: string; granted: boolean };

/** Purposes with no secret to reveal, so the webhook can grant them outright. */
const WEBHOOK_GRANTABLE = new Set(["lifetime_membership", "play_pass"]);

/**
 * Settle one verified CoinPay webhook. Idempotent: every write is guarded by a
 * status transition, so a replay or a race with the status poll is a no-op.
 * Unknown payments and non-paid events return `handled: false` (the route
 * still answers 200 so CoinPay stops retrying).
 */
export async function settleCoinpayWebhook(evt: CoinpayWebhookEvent): Promise<WebhookOutcome> {
  const w = parseCoinpayWebhook(evt);
  if (!w.paymentId) return { handled: false, reason: "no payment id" };
  if (!w.paid) return { handled: false, reason: `status ${w.status || w.type || "unknown"}` };

  if (w.metadata.purpose === "prize_sponsorship") {
    let sponsorshipId = typeof w.metadata.sponsorship_id === "string" ? w.metadata.sponsorship_id : null;
    if (!sponsorshipId) {
      const r = await sqlClient.execute({
        sql: "SELECT id FROM prize_sponsorships WHERE coinpay_payment_id = ? LIMIT 1",
        args: [w.paymentId],
      });
      sponsorshipId = (r.rows[0]?.id as string) ?? null;
    }
    if (!sponsorshipId) return { handled: false, reason: "unknown sponsorship" };
    const { activated } = await activateSponsorship(sponsorshipId, w.paymentId);
    return { handled: true, kind: "sponsorship", sponsorshipId, activated };
  }

  // Paid purposes: the payments row is keyed by our ref and CoinPay's id; both
  // must agree, so a webhook can only settle the payment it was created for.
  const r = await sqlClient.execute({
    sql: "SELECT id, user_id, purpose, status, promo_code FROM payments WHERE coinpay_payment_id = ? LIMIT 1",
    args: [w.paymentId],
  });
  const row = r.rows[0];
  if (!row) return { handled: false, reason: "unknown payment" };
  const ref = row.id as string;
  if (typeof w.metadata.payment_ref === "string" && w.metadata.payment_ref !== ref) {
    return { handled: false, reason: "payment_ref mismatch" };
  }
  const metaUser = w.metadata.account_id ?? w.metadata.user_id;
  if (typeof metaUser === "string" && metaUser !== row.user_id) {
    return { handled: false, reason: "account mismatch" };
  }

  await sqlClient.execute({
    sql: "UPDATE payments SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
    args: [ref],
  });

  // An API key is shown exactly once, to the signed-in buyer on the status
  // poll; granting it here would mint a key nobody ever sees. Everything else
  // is delivered now so the buyer does not have to come back.
  if (!WEBHOOK_GRANTABLE.has(row.purpose as string)) {
    return { handled: true, kind: "payment", paymentRef: ref, granted: false };
  }
  const tx = await sqlClient.transaction("write");
  try {
    const grant = await grantPaymentInTransaction({
      tx,
      paymentId: ref,
      userId: row.user_id as string,
      purpose: row.purpose as string,
    });
    if (grant && row.promo_code) await recordPromoRedemption(row.promo_code as string, row.user_id as string);
    return { handled: true, kind: "payment", paymentRef: ref, granted: !!grant };
  } finally {
    tx.close();
  }
}
