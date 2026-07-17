import "server-only";
import { randomBytes } from "node:crypto";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { env } from "./env";
import { sendEmail, sendReferralInviteEmail } from "./email";
import { BASE_REWARDS } from "./prizes";

// Local copy to avoid an import cycle with auth.ts (which imports this module).
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The referral reward matches the weekly 1st-place prize (top of the pack).
const REFERRAL_REWARD = BASE_REWARDS[0]!;
const CLAIM_WINDOW_DAYS = 7;
const MAX_INVITES_PER_CALL = 20;

// Crockford-ish base32 without ambiguous characters (no I, L, O, U, 0, 1).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

function makeCode(len = 7): string {
  const buf = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i]! % ALPHABET.length];
  return out;
}

/** Return this user's stable share code, generating + persisting one on demand. */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const existing = await sqlClient.execute({
    sql: "SELECT referral_code FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  const current = existing.rows[0]?.referral_code as string | null | undefined;
  if (current) return current;

  // Retry on the (astronomically unlikely) unique-index collision.
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    try {
      const r = await sqlClient.execute({
        sql: "UPDATE users SET referral_code = ? WHERE id = ? AND referral_code IS NULL",
        args: [code, userId],
      });
      if (r.rowsAffected > 0) return code;
      // Someone set it concurrently — read it back.
      const again = await sqlClient.execute({
        sql: "SELECT referral_code FROM users WHERE id = ? LIMIT 1",
        args: [userId],
      });
      const c = again.rows[0]?.referral_code as string | undefined;
      if (c) return c;
    } catch {
      // unique collision on referral_code — try a new code
    }
  }
  throw new Error("Could not allocate a referral code.");
}

export function referralLink(code: string): string {
  return `${env.appUrl}/r/${code}`;
}

async function resolveReferrer(code: string): Promise<{ id: string; email: string } | null> {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const res = await sqlClient.execute({
    sql: "SELECT id, email FROM users WHERE referral_code = ? AND status != 'deleted' LIMIT 1",
    args: [c],
  });
  const row = res.rows[0];
  return row ? { id: row.id as string, email: row.email as string } : null;
}

/**
 * Called right after a new account is created. If `code` resolves to a real
 * referrer (and it isn't a self-referral), record the (pending) referral and
 * stamp users.referred_by. The reward is only granted later, on email verify.
 */
export async function recordReferralOnSignup(
  newUserId: string,
  newUserEmailNormalized: string,
  code: string | null | undefined,
): Promise<void> {
  if (!code) return;
  const referrer = await resolveReferrer(code);
  if (!referrer || referrer.id === newUserId) return;
  if (normalizeEmail(referrer.email) === newUserEmailNormalized) return; // trivial self-referral

  await sqlClient.execute({
    sql: "UPDATE users SET referred_by = ? WHERE id = ? AND referred_by IS NULL",
    args: [referrer.id, newUserId],
  });
  await sqlClient.execute({
    sql: `INSERT OR IGNORE INTO referrals (id, referrer_id, referred_user_id, status)
          VALUES (?, ?, ?, 'pending')`,
    args: [newId("ref"), referrer.id, newUserId],
  });
}

/**
 * Called when a user verifies their email. If they arrived via a referral,
 * grant the referrer a coupon matching the weekly 1st prize and mark the
 * referral rewarded. Idempotent — a referral only pays out once.
 */
export async function rewardReferralOnVerify(referredUserId: string): Promise<void> {
  const res = await sqlClient.execute({
    sql: "SELECT id, referrer_id FROM referrals WHERE referred_user_id = ? AND status = 'pending' LIMIT 1",
    args: [referredUserId],
  });
  const referral = res.rows[0];
  if (!referral) return;
  const referrerId = referral.referrer_id as string;

  // Claim the pending referral atomically so a double verify can't pay twice.
  const claim = await sqlClient.execute({
    sql: "UPDATE referrals SET status = 'rewarded', rewarded_at = ? WHERE id = ? AND status = 'pending'",
    args: [new Date().toISOString(), referral.id],
  });
  if (claim.rowsAffected === 0) return;

  const now = new Date();
  const nowISO = now.toISOString();
  const deadline = new Date(now.getTime() + CLAIM_WINDOW_DAYS * 86400_000).toISOString();
  const prizeId = newId("prz");
  // A referral coupon reuses the prizes table (so it shows up on /prizes and
  // uses the same claim → admin-fulfil flow) but is tagged source='referral' so
  // it never appears in the weekly leaderboard pack.
  await sqlClient.execute({
    sql: `INSERT INTO prizes (id, period_start, period_end, rank, reward_kind, reward_label, user_id, status, claim_deadline, carried_over, notified_at, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'unclaimed', ?, 0, ?, 'referral')`,
    args: [prizeId, nowISO, nowISO, 1, REFERRAL_REWARD.kind, REFERRAL_REWARD.label, referrerId, deadline, nowISO],
  });
  await sqlClient.execute({
    sql: "UPDATE referrals SET reward_prize_id = ? WHERE id = ?",
    args: [prizeId, referral.id],
  });

  await notifyReferrer(referrerId, deadline).catch(() => {});
}

async function notifyReferrer(referrerId: string, deadline: string): Promise<void> {
  const u = await sqlClient.execute({ sql: "SELECT email FROM users WHERE id = ? LIMIT 1", args: [referrerId] });
  const email = u.rows[0]?.email as string | undefined;
  if (!email) return;
  const by = new Date(deadline).toUTCString();
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h1 style="font-size:20px">🎉 Your friend joined AIorNot.vote — here's your reward!</h1>
      <p>Someone you invited just created a verified account. As a thank-you you've earned a coupon that matches our weekly 1st-place prize:</p>
      <p style="font-size:16px"><strong>${REFERRAL_REWARD.label}</strong></p>
      <p><a href="${env.appUrl}/prizes" style="background:#FF3D8A;color:#08080C;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Claim your reward →</a></p>
      <p style="color:#888;font-size:13px">Claim by ${by}, or it expires. Keep inviting friends to earn more.</p>
    </div>`;
  await sendEmail({
    to: email,
    subject: "🎉 You earned a referral reward — AIorNot.vote",
    html,
    text: `A friend you invited joined AIorNot.vote. You earned: ${REFERRAL_REWARD.label}. Claim at ${env.appUrl}/prizes by ${by}.`,
  });
}

export type InviteResult = { ok: true; sent: number; skipped: number } | { ok: false; error: string };

/**
 * Record + email a batch of invites for a referrer. Emails that already belong
 * to a verified account are skipped silently (no point inviting a member).
 */
export async function sendInvites(
  referrerId: string,
  referrerName: string | null,
  rawEmails: string[],
): Promise<InviteResult> {
  const code = await getOrCreateReferralCode(referrerId);
  const link = referralLink(code);

  // Dedupe + validate.
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of rawEmails) {
    const e = normalizeEmail(raw);
    if (!e || seen.has(e)) continue;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) continue;
    seen.add(e);
    emails.push(e);
    if (emails.length >= MAX_INVITES_PER_CALL) break;
  }
  if (emails.length === 0) return { ok: false, error: "Enter at least one valid email address." };

  const selfEmail = (
    await sqlClient.execute({ sql: "SELECT email_normalized FROM users WHERE id = ? LIMIT 1", args: [referrerId] })
  ).rows[0]?.email_normalized as string | undefined;

  let sent = 0;
  let skipped = 0;
  for (const email of emails) {
    if (email === selfEmail) {
      skipped++;
      continue;
    }
    const existing = await sqlClient.execute({
      sql: "SELECT email_verified_at FROM users WHERE email_normalized = ? LIMIT 1",
      args: [email],
    });
    if (existing.rows[0]?.email_verified_at) {
      skipped++; // already a real user — nothing to gain, don't spam them
      continue;
    }
    await sqlClient.execute({
      sql: "INSERT OR IGNORE INTO referral_invites (id, referrer_id, email_normalized) VALUES (?, ?, ?)",
      args: [newId("rin"), referrerId, email],
    });
    try {
      await sendReferralInviteEmail(email, referrerName, link);
      sent++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, sent, skipped };
}

export type ReferralStats = {
  code: string;
  link: string;
  invited: number; // distinct emails invited by address
  pending: number; // signed up via referral, not yet verified/rewarded
  rewarded: number; // referrals that paid out a coupon
  rewardLabel: string;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const code = await getOrCreateReferralCode(userId);
  const [invites, pending, rewarded] = await Promise.all([
    sqlClient.execute({ sql: "SELECT COUNT(*) AS n FROM referral_invites WHERE referrer_id = ?", args: [userId] }),
    sqlClient.execute({ sql: "SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'pending'", args: [userId] }),
    sqlClient.execute({ sql: "SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'rewarded'", args: [userId] }),
  ]);
  return {
    code,
    link: referralLink(code),
    invited: Number(invites.rows[0]?.n ?? 0),
    pending: Number(pending.rows[0]?.n ?? 0),
    rewarded: Number(rewarded.rows[0]?.n ?? 0),
    rewardLabel: REFERRAL_REWARD.label,
  };
}
