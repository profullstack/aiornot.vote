import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { env } from "./env";
import { sendEmail } from "./email";
import { escapeHtml } from "./html";

// The base weekly prize pack (top 3 of the weekly leaderboard).
export const BASE_REWARDS: Array<{ kind: string; label: string }> = [
  { kind: "bittorrented_lifetime", label: "Free lifetime membership at bittorrented.com" },
  { kind: "crawlproof_50", label: "50% off CrawlProof.com fill-ups" },
  { kind: "crawlproof_25", label: "25% off CrawlProof.com fill-ups" },
];

const PRIZE_MIN_SCORED = Number(process.env.PRIZE_MIN_SCORED || 3);
const CLAIM_WINDOW_DAYS = 7;

export type PrizeRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  rank: number;
  rewardKind: string;
  rewardLabel: string;
  userId: string | null;
  status: string;
  claimDeadline: string;
  claimedAt: string | null;
  carriedOver: boolean;
  createdAt: string;
};

function mondayUTC(d: Date): Date {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - day);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** The most-recently-completed week [start, end). */
export function prevCompletedWeek(now = new Date()): { start: string; end: string } {
  const thisMon = mondayUTC(now);
  const start = new Date(thisMon);
  start.setUTCDate(start.getUTCDate() - 7);
  return { start: start.toISOString(), end: thisMon.toISOString() };
}

/** Monday of the week currently being played (what sponsorships target). */
export function currentWeekStart(now = new Date()): string {
  return mondayUTC(now).toISOString();
}

/** Ranked winners for an arbitrary [start, end) window. */
async function winnersForPeriod(startISO: string, endISO: string, limit: number): Promise<Array<{ userId: string; correct: number; scored: number }>> {
  const res = await sqlClient.execute({
    sql: `SELECT u.id AS user_id,
                 SUM(CASE WHEN g.is_correct = 1 THEN 1 ELSE 0 END) AS correct,
                 COUNT(*) AS scored, MAX(g.created_at) AS last
          FROM guesses g JOIN users u ON u.id = g.user_id
          WHERE u.email_verified_at IS NOT NULL AND u.status = 'active' AND g.is_scored = 1
            AND g.created_at >= ? AND g.created_at < ?
          GROUP BY u.id
          HAVING scored >= ?
          ORDER BY correct DESC, (CAST(correct AS REAL) / scored) DESC, scored DESC, last DESC
          LIMIT ?`,
    args: [startISO, endISO, PRIZE_MIN_SCORED, limit],
  });
  return res.rows.map((r) => ({ userId: r.user_id as string, correct: Number(r.correct), scored: Number(r.scored) }));
}

/** Mark unclaimed prizes past their deadline as expired (their reward rolls over). */
export async function expirePrizes(): Promise<number> {
  const r = await sqlClient.execute({
    sql: "UPDATE prizes SET status = 'expired' WHERE status = 'unclaimed' AND claim_deadline < ?",
    args: [new Date().toISOString()],
  });
  return r.rowsAffected;
}

export type DrawResult = { drawn: boolean; reason?: string; awarded: number; carriedIn: number; sponsored?: number; period: { start: string; end: string } };

/**
 * Draw the weekly prize pack for the most-recently-completed week. Base rewards
 * plus any rewards rolled over from expired/unawarded prizes are awarded to the
 * top players in order. Idempotent per period. Winners are emailed.
 */
export async function drawWeeklyPrizes(opts?: { period?: { start: string; end: string } }): Promise<DrawResult> {
  const period = opts?.period ?? prevCompletedWeek();

  const already = await sqlClient.execute({
    sql: "SELECT 1 FROM prizes WHERE period_start = ? AND source = 'weekly' LIMIT 1",
    args: [period.start],
  });
  if (already.rows.length > 0) {
    return { drawn: false, reason: "already drawn for this period", awarded: 0, carriedIn: 0, period };
  }

  await expirePrizes();

  // Rewards rolled over from expired / previously-unawarded prizes.
  const carry = await sqlClient.execute({
    sql: "SELECT id, reward_kind, reward_label FROM prizes WHERE status = 'expired' AND source = 'weekly' ORDER BY created_at ASC",
    args: [],
  });
  const carryRewards = carry.rows.map((r) => ({ kind: r.reward_kind as string, label: r.reward_label as string, sourceId: r.id as string }));

  // Sponsor-funded prizes for the drawn week (marked fulfilled below).
  const sponsors = await sqlClient.execute({
    sql: "SELECT id, prize_label, sponsor_name FROM prize_sponsorships WHERE period_start = ? AND status = 'active' ORDER BY created_at ASC",
    args: [period.start],
  });
  const sponsorRewards = sponsors.rows.map((r) => ({
    kind: "sponsored",
    label: `${r.prize_label as string} — sponsored by ${r.sponsor_name as string}`,
    sponsorshipId: r.id as string,
  }));

  const pack = [
    ...sponsorRewards.map((r) => ({ kind: r.kind, label: r.label, carried: false, sourceId: null as string | null })),
    ...BASE_REWARDS.map((r) => ({ ...r, carried: false, sourceId: null as string | null })),
    ...carryRewards.map((r) => ({ kind: r.kind, label: r.label, carried: true, sourceId: r.sourceId })),
  ];

  const winners = await winnersForPeriod(period.start, period.end, pack.length);
  const deadline = new Date(Date.now() + CLAIM_WINDOW_DAYS * 86400_000).toISOString();

  // Mark carried-over sources as rolled so they aren't carried twice.
  for (const c of carryRewards) {
    await sqlClient.execute({ sql: "UPDATE prizes SET status = 'rolled' WHERE id = ?", args: [c.sourceId] });
  }

  let awarded = 0;
  for (let i = 0; i < pack.length; i++) {
    const reward = pack[i]!;
    const winner = winners[i];
    const id = newId("prz");
    // Awarded to a player → unclaimed; no player for this slot → expired (rolls again).
    const status = winner ? "unclaimed" : "expired";
    await sqlClient.execute({
      sql: `INSERT INTO prizes (id, period_start, period_end, rank, reward_kind, reward_label, user_id, status, claim_deadline, carried_over, notified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, period.start, period.end, i + 1, reward.kind, reward.label, winner?.userId ?? null, status, deadline, reward.carried ? 1 : 0, winner ? new Date().toISOString() : null],
    });
    if (winner) {
      awarded++;
      await notifyWinner(winner.userId, reward.label, i + 1, deadline);
    }
  }

  // Sponsorships for this week have now been placed into the pack.
  if (sponsorRewards.length > 0) {
    await sqlClient.execute({
      sql: "UPDATE prize_sponsorships SET status = 'fulfilled' WHERE period_start = ? AND status = 'active'",
      args: [period.start],
    });
  }

  return { drawn: true, awarded, carriedIn: carryRewards.length, sponsored: sponsorRewards.length, period };
}

async function notifyWinner(userId: string, rewardLabel: string, rank: number, deadline: string): Promise<void> {
  const u = await sqlClient.execute({ sql: "SELECT email FROM users WHERE id = ? LIMIT 1", args: [userId] });
  const email = u.rows[0]?.email as string | undefined;
  if (!email) return;
  const by = new Date(deadline).toUTCString();
  const rewardLabelHtml = escapeHtml(rewardLabel);
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">🏆 You won a weekly prize on AIorNot.vote!</h1>
      <p>You finished <strong>#${rank}</strong> on last week's leaderboard and won:</p>
      <p style="font-size:16px"><strong>${rewardLabelHtml}</strong></p>
      <p><a href="${env.appUrl}/prizes" style="background:#FF3D8A;color:#08080C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Claim your prize →</a></p>
      <p style="color:#888;font-size:13px">Claim by ${by}, or it rolls into a future prize pack.</p>
    </div>`;
  await sendEmail({ to: email, subject: "🏆 You won a prize — AIorNot.vote", html, text: `You won: ${rewardLabel}. Claim at ${env.appUrl}/prizes by ${by}.` }).catch(() => {});
}

export type ClaimResult = { ok: true; rewardLabel: string } | { ok: false; error: string };

export async function claimPrize(userId: string, prizeId: string): Promise<ClaimResult> {
  const res = await sqlClient.execute({ sql: "SELECT id, user_id, status, reward_label, claim_deadline FROM prizes WHERE id = ? LIMIT 1", args: [prizeId] });
  const p = res.rows[0];
  if (!p || p.user_id !== userId) return { ok: false, error: "Prize not found." };
  if (p.status === "claimed") return { ok: false, error: "You already claimed this prize." };
  if (p.status !== "unclaimed") return { ok: false, error: "This prize is no longer available." };
  if (new Date(p.claim_deadline as string).getTime() < Date.now()) {
    await sqlClient.execute({ sql: "UPDATE prizes SET status = 'expired' WHERE id = ?", args: [prizeId] });
    return { ok: false, error: "The claim window has closed." };
  }
  const claim = await sqlClient.execute({
    sql: "UPDATE prizes SET status = 'claimed', claimed_at = ? WHERE id = ? AND status = 'unclaimed'",
    args: [new Date().toISOString(), prizeId],
  });
  if (claim.rowsAffected === 0) {
    return { ok: false, error: "This prize has already been claimed." };
  }

  // Notify admins to fulfil (send the code out of band).
  const email = (await sqlClient.execute({ sql: "SELECT email FROM users WHERE id = ? LIMIT 1", args: [userId] })).rows[0]?.email as string | undefined;
  const emailHtml = escapeHtml(email);
  const rewardLabelHtml = escapeHtml(p.reward_label);
  for (const admin of env.adminEmails) {
    await sendEmail({
      to: admin,
      subject: "Prize claimed — send the code",
      html: `<p><strong>${emailHtml}</strong> claimed: <strong>${rewardLabelHtml}</strong>.</p><p>Send them the code.</p>`,
      text: `${email} claimed: ${p.reward_label}. Send the code.`,
    }).catch(() => {});
  }
  return { ok: true, rewardLabel: p.reward_label as string };
}

// ---- Read helpers ----------------------------------------------------------

export async function getClaimablePrizes(userId: string): Promise<PrizeRow[]> {
  const res = await sqlClient.execute({
    sql: "SELECT * FROM prizes WHERE user_id = ? AND status = 'unclaimed' AND claim_deadline > ? ORDER BY rank ASC",
    args: [userId, new Date().toISOString()],
  });
  return res.rows.map(rowToPrize);
}

export async function getUserPrizes(userId: string): Promise<PrizeRow[]> {
  const res = await sqlClient.execute({ sql: "SELECT * FROM prizes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", args: [userId] });
  return res.rows.map(rowToPrize);
}

export async function getLatestPack(): Promise<PrizeRow[]> {
  const latest = await sqlClient.execute({ sql: "SELECT period_start FROM prizes WHERE source = 'weekly' ORDER BY period_start DESC LIMIT 1", args: [] });
  const period = latest.rows[0]?.period_start as string | undefined;
  if (!period) return [];
  const res = await sqlClient.execute({ sql: "SELECT * FROM prizes WHERE period_start = ? AND source = 'weekly' ORDER BY rank ASC", args: [period] });
  return res.rows.map(rowToPrize);
}

export async function getRecentWinners(limit = 12): Promise<Array<{ rank: number; rewardLabel: string; displayName: string; periodStart: string; status: string }>> {
  const res = await sqlClient.execute({
    sql: `SELECT p.rank, p.reward_label, p.period_start, p.status,
                 COALESCE(NULLIF(u.display_name,''), 'anon-' || substr(u.id,-5)) AS display_name
          FROM prizes p JOIN users u ON u.id = p.user_id
          WHERE p.user_id IS NOT NULL AND p.source = 'weekly' ORDER BY p.period_start DESC, p.rank ASC LIMIT ?`,
    args: [limit],
  });
  return res.rows.map((r) => ({ rank: Number(r.rank), rewardLabel: r.reward_label as string, displayName: r.display_name as string, periodStart: r.period_start as string, status: r.status as string }));
}

function rowToPrize(r: Record<string, unknown>): PrizeRow {
  return {
    id: r.id as string,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    rank: Number(r.rank),
    rewardKind: r.reward_kind as string,
    rewardLabel: r.reward_label as string,
    userId: (r.user_id as string) ?? null,
    status: r.status as string,
    claimDeadline: r.claim_deadline as string,
    claimedAt: (r.claimed_at as string) ?? null,
    carriedOver: Number(r.carried_over ?? 0) === 1,
    createdAt: r.created_at as string,
  };
}
