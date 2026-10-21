import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { env } from "./env";
import { CHECKOUT_BLOCKCHAIN, checkoutSessionUrl, createCoinpayCheckoutSession, getCoinpayReferenceStatus, isCheckoutSessionId } from "./coinpay";
import { currentWeekStart } from "./prizes";
import { sendEmail } from "./email";
import { escapeHtml } from "./html";
import { normalizeSponsorUrl } from "./sponsor-url";
import { MIN_SPONSOR_USD, normalizeSponsorAmountUsd } from "./sponsor-amount";

export { MIN_SPONSOR_USD };

export type Sponsorship = {
  id: string;
  sponsorName: string;
  sponsorUrl: string | null;
  prizeLabel: string;
  message: string | null;
  amountUsd: number;
  blockchain: string | null;
  paymentAddress: string | null;
  cryptoAmount: string | null;
  status: string;
  periodStart: string;
  /** CoinPay hosted checkout page, for sponsorships opened as a session. */
  checkoutUrl: string | null;
};

function rowToSponsorship(r: Record<string, unknown>): Sponsorship {
  return {
    id: r.id as string,
    sponsorName: r.sponsor_name as string,
    sponsorUrl: (r.sponsor_url as string) ?? null,
    prizeLabel: r.prize_label as string,
    message: (r.message as string) ?? null,
    amountUsd: Number(r.amount_usd),
    blockchain: (r.blockchain as string) ?? null,
    paymentAddress: (r.payment_address as string) ?? null,
    cryptoAmount: (r.crypto_amount as string) ?? null,
    status: r.status as string,
    periodStart: r.period_start as string,
    checkoutUrl: isCheckoutSessionId(r.coinpay_payment_id) ? checkoutSessionUrl(r.coinpay_payment_id) : null,
  };
}

export type CreateSponsorInput = {
  userId: string | null;
  /** Buyer email: the CoinPay checkout customer. */
  email?: string | null;
  sponsorName: string;
  sponsorUrl?: string | null;
  prizeLabel: string;
  message?: string | null;
  amountUsd: unknown;
};

export async function createSponsorship(
  input: CreateSponsorInput,
): Promise<{ ok: true; id: string; checkoutUrl: string } | { ok: false; error: string }> {
  if (!env.coinpayConfigured) return { ok: false, error: "Payments are not configured." };
  const name = input.sponsorName.trim().slice(0, 60);
  const prize = input.prizeLabel.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Sponsor name is required." };
  if (!prize) return { ok: false, error: "Describe the prize you're offering." };
  const sponsorUrl = normalizeSponsorUrl(input.sponsorUrl);
  if (!sponsorUrl.ok) return sponsorUrl;
  const sponsorAmount = normalizeSponsorAmountUsd(input.amountUsd);
  if (!sponsorAmount.ok) return sponsorAmount;
  const amount = sponsorAmount.amount;

  if (!input.userId || !input.email) return { ok: false, error: "Sign in with an email address to sponsor a prize." };

  const id = newId("spo");
  const period = currentWeekStart();
  const base = env.appUrl.replace(/\/+$/, "");
  const created = await createCoinpayCheckoutSession({
    amountUsd: amount,
    description: `AIorNot.vote weekly prize sponsorship: ${name}`,
    customerEmail: input.email,
    accountId: input.userId,
    metadata: {
      purpose: "prize_sponsorship",
      sponsorship_id: id,
      user_id: input.userId,
      app: "aiornot.vote",
    },
    successUrl: `${base}/sponsor/checkout/${id}?session={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${base}/prizes`,
    idempotencyKey: `aiornot-${id}`,
  });
  if (!created.ok) return { ok: false, error: created.error };

  await sqlClient.execute({
    sql: `INSERT INTO prize_sponsorships
      (id, user_id, sponsor_name, sponsor_url, prize_label, message, amount_usd, blockchain,
       coinpay_payment_id, payment_address, crypto_amount, status, period_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'pending', ?)`,
    args: [
      id, input.userId, name, sponsorUrl.url, prize, input.message?.trim()?.slice(0, 200) || null,
      amount, CHECKOUT_BLOCKCHAIN, created.session.id, period,
    ],
  });
  return { ok: true, id, checkoutUrl: created.session.url };
}

export async function getSponsorship(id: string, userId?: string): Promise<Sponsorship | null> {
  const r = await sqlClient.execute({
    sql: userId
      ? "SELECT * FROM prize_sponsorships WHERE id = ? AND user_id = ? LIMIT 1"
      : "SELECT * FROM prize_sponsorships WHERE id = ? LIMIT 1",
    args: userId ? [id, userId] : [id],
  });
  return r.rows[0] ? rowToSponsorship(r.rows[0] as Record<string, unknown>) : null;
}

/** Poll CoinPay; activate the sponsorship on payment (idempotent). */
export async function checkSponsorship(id: string, userId?: string): Promise<{ status: string } | null> {
  const r = await sqlClient.execute({
    sql: userId
      ? "SELECT id, status, coinpay_payment_id, sponsor_name, prize_label, amount_usd FROM prize_sponsorships WHERE id = ? AND user_id = ? LIMIT 1"
      : "SELECT id, status, coinpay_payment_id, sponsor_name, prize_label, amount_usd FROM prize_sponsorships WHERE id = ? LIMIT 1",
    args: userId ? [id, userId] : [id],
  });
  const row = r.rows[0];
  if (!row) return null;
  if (row.status === "active" || row.status === "fulfilled") return { status: "active" };

  const cp = await getCoinpayReferenceStatus(row.coinpay_payment_id as string);
  if (!cp || !cp.paid) return { status: cp?.status || "pending" };

  await activateSponsorship(id, row.coinpay_payment_id as string);
  return { status: "active" };
}

/**
 * Flip a pending sponsorship to active and tell the admins, exactly once.
 * The UPDATE is the idempotency guard: a replayed webhook, or a webhook racing
 * the status poll, affects zero rows and sends nothing. Matching on the
 * CoinPay payment id as well as the sponsorship id means a webhook can only
 * activate the sponsorship that payment was created for.
 */
export async function activateSponsorship(
  sponsorshipId: string,
  coinpayPaymentId: string,
): Promise<{ activated: boolean }> {
  const flip = await sqlClient.execute({
    sql: "UPDATE prize_sponsorships SET status = 'active', paid_at = CURRENT_TIMESTAMP WHERE id = ? AND coinpay_payment_id = ? AND status = 'pending'",
    args: [sponsorshipId, coinpayPaymentId],
  });
  if (flip.rowsAffected === 0) return { activated: false };
  const r = await sqlClient.execute({
    sql: "SELECT sponsor_name, prize_label, amount_usd FROM prize_sponsorships WHERE id = ? LIMIT 1",
    args: [sponsorshipId],
  });
  const row = r.rows[0];
  if (row) {
    const sponsorNameHtml = escapeHtml(row.sponsor_name);
    const prizeLabelHtml = escapeHtml(row.prize_label);
    for (const admin of env.adminEmails) {
      await sendEmail({
        to: admin,
        subject: "New prize sponsorship - AIorNot.vote",
        html: `<p><strong>${sponsorNameHtml}</strong> sponsored this week's prize: <strong>${prizeLabelHtml}</strong> ($${Number(row.amount_usd)}).</p>`,
        text: `${row.sponsor_name} sponsored: ${row.prize_label} ($${Number(row.amount_usd)}).`,
      }).catch(() => {});
    }
  }
  return { activated: true };
}

/** Active sponsorships for the current (being-played) week — shown on /prizes. */
export async function getCurrentSponsors(): Promise<Sponsorship[]> {
  const r = await sqlClient.execute({
    sql: "SELECT * FROM prize_sponsorships WHERE period_start = ? AND status IN ('active','fulfilled') ORDER BY created_at ASC",
    args: [currentWeekStart()],
  });
  return r.rows.map((row) => rowToSponsorship(row as Record<string, unknown>));
}
