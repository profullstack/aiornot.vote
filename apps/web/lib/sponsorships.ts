import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { env } from "./env";
import { createCoinpayPayment, getCoinpayPayment, isPaymentPaid } from "./coinpay";
import { currentWeekStart } from "./prizes";
import { sendEmail } from "./email";
import { escapeHtml } from "./html";

export const MIN_SPONSOR_USD = 5;

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
  };
}

export type CreateSponsorInput = {
  userId: string | null;
  sponsorName: string;
  sponsorUrl?: string | null;
  prizeLabel: string;
  message?: string | null;
  amountUsd: number;
  blockchain: string;
};

export async function createSponsorship(
  input: CreateSponsorInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!env.coinpayConfigured) return { ok: false, error: "Payments are not configured." };
  const name = input.sponsorName.trim().slice(0, 60);
  const prize = input.prizeLabel.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Sponsor name is required." };
  if (!prize) return { ok: false, error: "Describe the prize you're offering." };
  const amount = Math.round(Number(input.amountUsd) * 100) / 100;
  if (!(amount >= MIN_SPONSOR_USD)) return { ok: false, error: `Minimum sponsorship is $${MIN_SPONSOR_USD}.` };

  const id = newId("spo");
  const period = currentWeekStart();
  const created = await createCoinpayPayment({
    amountUsd: amount,
    blockchain: input.blockchain,
    description: `AIorNot.vote weekly prize sponsorship — ${name}`,
    metadata: { purpose: "prize_sponsorship", sponsorship_id: id, app: "aiornot.vote" },
  });
  if (!created.ok) return { ok: false, error: created.error };
  const p = created.payment;

  await sqlClient.execute({
    sql: `INSERT INTO prize_sponsorships
      (id, user_id, sponsor_name, sponsor_url, prize_label, message, amount_usd, blockchain,
       coinpay_payment_id, payment_address, crypto_amount, status, period_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    args: [
      id, input.userId, name, input.sponsorUrl?.trim() || null, prize, input.message?.trim()?.slice(0, 200) || null,
      amount, input.blockchain, p.id, p.payment_address ?? null, p.crypto_amount ?? null, period,
    ],
  });
  return { ok: true, id };
}

export async function getSponsorship(id: string): Promise<Sponsorship | null> {
  const r = await sqlClient.execute({ sql: "SELECT * FROM prize_sponsorships WHERE id = ? LIMIT 1", args: [id] });
  return r.rows[0] ? rowToSponsorship(r.rows[0] as Record<string, unknown>) : null;
}

/** Poll CoinPay; activate the sponsorship on payment (idempotent). */
export async function checkSponsorship(id: string): Promise<{ status: string } | null> {
  const r = await sqlClient.execute({ sql: "SELECT id, status, coinpay_payment_id, sponsor_name, prize_label, amount_usd FROM prize_sponsorships WHERE id = ? LIMIT 1", args: [id] });
  const row = r.rows[0];
  if (!row) return null;
  if (row.status === "active" || row.status === "fulfilled") return { status: "active" };

  const cp = await getCoinpayPayment(row.coinpay_payment_id as string);
  if (!cp || !isPaymentPaid(cp.status)) return { status: cp?.status || "pending" };

  const flip = await sqlClient.execute({
    sql: "UPDATE prize_sponsorships SET status = 'active', paid_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
    args: [id],
  });
  if (flip.rowsAffected > 0) {
    const sponsorNameHtml = escapeHtml(row.sponsor_name);
    const prizeLabelHtml = escapeHtml(row.prize_label);
    for (const admin of env.adminEmails) {
      await sendEmail({
        to: admin,
        subject: "New prize sponsorship — AIorNot.vote",
        html: `<p><strong>${sponsorNameHtml}</strong> sponsored this week's prize: <strong>${prizeLabelHtml}</strong> ($${Number(row.amount_usd)}).</p>`,
        text: `${row.sponsor_name} sponsored: ${row.prize_label} ($${Number(row.amount_usd)}).`,
      }).catch(() => {});
    }
  }
  return { status: "active" };
}

/** Active sponsorships for the current (being-played) week — shown on /prizes. */
export async function getCurrentSponsors(): Promise<Sponsorship[]> {
  const r = await sqlClient.execute({
    sql: "SELECT * FROM prize_sponsorships WHERE period_start = ? AND status IN ('active','fulfilled') ORDER BY created_at ASC",
    args: [currentWeekStart()],
  });
  return r.rows.map((row) => rowToSponsorship(row as Record<string, unknown>));
}
