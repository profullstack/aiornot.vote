import "server-only";
import { sqlClient } from "./db";
import { ids } from "@aiornot/db";
import { hashPassword, verifyPassword } from "./password";
import { randomToken, hmac } from "./crypto";
import { env, isAdminEmail } from "./env";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { recordReferralOnSignup, rewardReferralOnVerify } from "./referrals";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const VERIFY_SALT = "email-verification-token";

/** Create a fresh verification token, persist its hash, and email the link. */
export async function issueVerification(userId: string, email: string): Promise<void> {
  const token = randomToken();
  const tokenHash = hmac(token, VERIFY_SALT);
  const expires = new Date(
    Date.now() + env.verificationTtlMinutes * 60_000,
  ).toISOString();

  await sqlClient.execute({
    sql: `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [ids.verification(), userId, tokenHash, expires],
  });

  const url = `${env.appUrl}/verify-email?token=${token}`;
  // Email delivery failures must not block account creation — the token is
  // already persisted and the user can request a resend.
  try {
    await sendVerificationEmail(email, url);
  } catch (err) {
    console.error(`[verification] failed to send email to ${email}:`, (err as Error).message);
  }
}

export type SignupResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function signup(
  emailRaw: string,
  password: string,
  displayName?: string,
  referralCode?: string | null,
): Promise<SignupResult> {
  const email = emailRaw.trim();
  const normalized = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }

  const existing = await sqlClient.execute({
    sql: "SELECT id, password_hash FROM users WHERE email_normalized = ? LIMIT 1",
    args: [normalized],
  });
  const existingRow = existing.rows[0];
  if (existingRow && existingRow.password_hash) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const pw = await hashPassword(password);
  const role = isAdminEmail(normalized) ? "admin" : "user";

  let userId: string;
  if (existingRow) {
    // Claim a passwordless placeholder (e.g. a seeded admin, or a future
    // magic-link account) by setting a password. Force re-verification so
    // control of the inbox is proven before the account can be used —
    // this prevents anyone from grabbing a pre-verified admin email.
    userId = existingRow.id as string;
    await sqlClient.execute({
      sql: `UPDATE users
            SET password_hash = ?, display_name = COALESCE(?, display_name), role = ?,
                status = 'pending_email_verification', email_verified_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [pw, displayName?.trim() || null, role, userId],
    });
  } else {
    userId = ids.user();
    await sqlClient.execute({
      sql: `INSERT INTO users (id, email, email_normalized, password_hash, display_name, status, role)
            VALUES (?, ?, ?, ?, ?, 'pending_email_verification', ?)`,
      args: [userId, email, normalized, pw, displayName?.trim() || null, role],
    });
  }
  await sqlClient.execute({
    sql: "INSERT OR IGNORE INTO user_stats (user_id) VALUES (?)",
    args: [userId],
  });

  // Attribute the referral (if any). Reward is granted later, on email verify.
  await recordReferralOnSignup(userId, normalized, referralCode).catch((err) => {
    console.error(`[referral] failed to record for ${userId}:`, (err as Error).message);
  });

  await issueVerification(userId, email);
  return { ok: true, userId };
}

export type LoginResult =
  | { ok: true; userId: string; verified: boolean }
  | { ok: false; error: string };

export async function login(
  emailRaw: string,
  password: string,
): Promise<LoginResult> {
  const normalized = normalizeEmail(emailRaw);
  const res = await sqlClient.execute({
    sql: `SELECT id, password_hash, status, email_verified_at
          FROM users WHERE email_normalized = ? LIMIT 1`,
    args: [normalized],
  });
  const row = res.rows[0];
  // Constant-ish failure to avoid leaking which emails exist.
  if (!row || !row.password_hash) {
    return { ok: false, error: "Invalid email or password." };
  }
  if (row.status === "suspended" || row.status === "deleted") {
    return { ok: false, error: "This account is not available." };
  }
  const ok = await verifyPassword(row.password_hash as string, password);
  if (!ok) return { ok: false, error: "Invalid email or password." };

  await sqlClient.execute({
    sql: "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [row.id],
  });
  return {
    ok: true,
    userId: row.id as string,
    verified: row.email_verified_at != null,
  };
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  if (!token) return { ok: false, error: "Missing token." };
  const tokenHash = hmac(token, VERIFY_SALT);
  const res = await sqlClient.execute({
    sql: `SELECT id, user_id, expires_at, consumed_at
          FROM email_verification_tokens WHERE token_hash = ? LIMIT 1`,
    args: [tokenHash],
  });
  const row = res.rows[0];
  if (!row) return { ok: false, error: "Invalid or expired verification link." };
  if (row.consumed_at) return { ok: false, error: "This link was already used." };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This verification link has expired." };
  }

  await sqlClient.execute({
    sql: "UPDATE email_verification_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [row.id],
  });
  await sqlClient.execute({
    sql: `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, status = 'active', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'pending_email_verification'`,
    args: [row.user_id],
  });
  // If already active (re-verify), still ensure verified timestamp set.
  await sqlClient.execute({
    sql: `UPDATE users SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE id = ?`,
    args: [row.user_id],
  });
  // Email is now proven — pay out any pending referral for this user.
  await rewardReferralOnVerify(row.user_id as string).catch((err) => {
    console.error(`[referral] failed to reward on verify for ${row.user_id}:`, (err as Error).message);
  });
  return { ok: true, userId: row.user_id as string };
}

export async function resendVerification(emailRaw: string): Promise<void> {
  const normalized = normalizeEmail(emailRaw);
  const res = await sqlClient.execute({
    sql: `SELECT id, email, email_verified_at FROM users WHERE email_normalized = ? LIMIT 1`,
    args: [normalized],
  });
  const row = res.rows[0];
  // Silent success regardless, to avoid account enumeration.
  if (!row || row.email_verified_at) return;
  await issueVerification(row.id as string, row.email as string);
}

// ---- Password reset -------------------------------------------------------

const RESET_SALT = "password-reset-token";

/** Create a reset token and email the link. Silent to avoid account enumeration. */
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const normalized = normalizeEmail(emailRaw);
  const res = await sqlClient.execute({
    sql: `SELECT id, email FROM users WHERE email_normalized = ? AND status != 'deleted' LIMIT 1`,
    args: [normalized],
  });
  const row = res.rows[0];
  if (!row) return; // silent

  const token = randomToken();
  const tokenHash = hmac(token, RESET_SALT);
  const expires = new Date(Date.now() + env.verificationTtlMinutes * 60_000).toISOString();
  await sqlClient.execute({
    sql: `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
          VALUES (?, ?, ?, ?)`,
    args: [ids.verification(), row.id, tokenHash, expires],
  });

  const url = `${env.appUrl}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(row.email as string, url);
  } catch (err) {
    console.error(`[password-reset] failed to send email:`, (err as Error).message);
  }
}

export type ResetResult =
  | { ok: true; userId: string }
  | { ok: false; error: string };

/**
 * Consume a reset token and set a new password. A successful reset also proves
 * inbox control, so it verifies the email and activates a pending account, and
 * invalidates all existing sessions for safety.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  if (!token) return { ok: false, error: "Missing reset token." };
  if (newPassword.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  const tokenHash = hmac(token, RESET_SALT);
  const res = await sqlClient.execute({
    sql: `SELECT id, user_id, expires_at, consumed_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1`,
    args: [tokenHash],
  });
  const row = res.rows[0];
  if (!row) return { ok: false, error: "Invalid or expired reset link." };
  if (row.consumed_at) return { ok: false, error: "This reset link was already used." };
  if (new Date(row.expires_at as string).getTime() < Date.now()) {
    return { ok: false, error: "This reset link has expired." };
  }

  const userId = row.user_id as string;
  const pw = await hashPassword(newPassword);
  await sqlClient.execute({
    sql: `UPDATE users
          SET password_hash = ?,
              email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
              status = CASE WHEN status = 'pending_email_verification' THEN 'active' ELSE status END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
    args: [pw, userId],
  });
  await sqlClient.execute({
    sql: "UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [row.id],
  });
  // Invalidate any other outstanding reset tokens + all sessions for this user.
  await sqlClient.execute({
    sql: "UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL",
    args: [userId],
  });
  await sqlClient.execute({ sql: "DELETE FROM sessions WHERE user_id = ?", args: [userId] });

  return { ok: true, userId };
}
