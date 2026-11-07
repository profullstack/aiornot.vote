import type { Client } from "@libsql/client";
import type { CoinpayPass } from "@profullstack/coinpay-onboard/pass";

export { PASS_URL } from "@profullstack/coinpay-onboard/pass";

type SqlExecutor = Pick<Client, "execute">;

/**
 * Profullstack Pass on aiornot.vote: a CoinPay user who deposited $99 into
 * their own CoinPay wallet gets a free month on every Profullstack property.
 *
 * Play is free here and membership, the submit pass and API access are
 * one-time purchases, so the month goes to the one time-based product: the
 * photo library pass. CoinPay reports the pass only in the userinfo `pass`
 * claim at sign-in, and the callback applies it to the account bound to the
 * CoinPay `sub` (lib/coinpay-signin.ts), never one found by email.
 *
 * users.library_pass_until becomes the later of its current end and the pass
 * end (max, not added days), so applying the same pass twice changes nothing
 * and paid days that run longer are kept.
 */

/** The new library_pass_until, or null when this pass does not move it. */
export function libraryUntilWithPass(
  before: string | null | undefined,
  pass: CoinpayPass | null | undefined,
  now = Date.now(),
): string | null {
  if (!pass?.active || !pass.expiresAt) return null;
  const end = pass.expiresAt.getTime();
  if (!Number.isFinite(end) || end <= now) return null;
  const cur = before ? Date.parse(before) : NaN;
  if (Number.isFinite(cur) && cur >= end) return null;
  return pass.expiresAt.toISOString();
}

/** Applies an active pass to the library pass. Returns the new end, or null when unchanged. */
export async function applyCoinpayPass(
  db: SqlExecutor,
  userId: string,
  pass: CoinpayPass | null | undefined,
  now = Date.now(),
): Promise<string | null> {
  if (!userId || !pass?.active) return null;
  // Compare-and-set on the old value, so a payment landing at the same moment
  // is never overwritten.
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await db.execute({ sql: "SELECT library_pass_until FROM users WHERE id = ? LIMIT 1", args: [userId] });
    if (!cur.rows[0]) return null;
    const before = (cur.rows[0].library_pass_until as string | null) ?? null;
    const until = libraryUntilWithPass(before, pass, now);
    if (!until) return null;
    const upd = before === null
      ? await db.execute({
          sql: "UPDATE users SET library_pass_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND library_pass_until IS NULL",
          args: [until, userId],
        })
      : await db.execute({
          sql: "UPDATE users SET library_pass_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND library_pass_until = ?",
          args: [until, userId, before],
        });
    if (Number(upd.rowsAffected ?? 0) === 1) return until;
  }
  throw new Error("library pass changed under us five times; try again");
}
