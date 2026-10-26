import "server-only";
import { sqlClient } from "./db";
import { extendLibraryPass } from "./library-pass";

/** Largest number of library days one grant may carry (ten years). */
export const MAX_GRANT_DAYS = 3650;

/**
 * Add `days` to a user's photo library pass, once per (user, source).
 *
 * This is the same column a paid $9 pass extends (users.library_pass_until),
 * so "can this person download from the library" keeps one answer wherever the
 * days came from. The library_pass_grants primary key makes it idempotent: a
 * redeemed code is `code:<codeId>`, an invite bonus `invite:<id>:<side>`, and
 * replaying either adds nothing. Returns whether this call applied the days
 * and the pass end afterwards.
 */
export async function grantLibraryDaysOnce(
  userId: string,
  days: number,
  source: string,
): Promise<{ applied: boolean; until: string | null }> {
  const d = Math.trunc(days);
  if (!Number.isFinite(d) || d < 1 || d > MAX_GRANT_DAYS) {
    throw new RangeError(`library days must be a whole number from 1 to ${MAX_GRANT_DAYS}`);
  }
  const tx = await sqlClient.transaction("write");
  try {
    const ins = await tx.execute({
      sql: "INSERT OR IGNORE INTO library_pass_grants (user_id, source, days, granted_at) VALUES (?, ?, ?, ?)",
      args: [userId, source, d, new Date().toISOString()],
    });
    if (ins.rowsAffected !== 1) {
      await tx.rollback();
      return { applied: false, until: await passUntil(userId) };
    }
    // Compare-and-set on the old value, so a payment landing at the same moment
    // is never overwritten: whichever writes second re-reads and stacks on top.
    for (let attempt = 0; attempt < 5; attempt++) {
      const cur = await tx.execute({
        sql: "SELECT library_pass_until FROM users WHERE id = ? LIMIT 1",
        args: [userId],
      });
      if (!cur.rows[0]) throw new Error(`no such user ${userId}`);
      const before = (cur.rows[0].library_pass_until as string | null) ?? null;
      const until = extendLibraryPass(before, d);
      const upd = before === null
        ? await tx.execute({
            sql: "UPDATE users SET library_pass_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND library_pass_until IS NULL",
            args: [until, userId],
          })
        : await tx.execute({
            sql: "UPDATE users SET library_pass_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND library_pass_until = ?",
            args: [until, userId, before],
          });
      if (upd.rowsAffected === 1) {
        await tx.commit();
        return { applied: true, until };
      }
    }
    throw new Error("library pass changed under us five times; try again");
  } catch (err) {
    if (!tx.closed) await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }
}

/** The sources already granted to a user, of those asked about. */
export async function grantedSources(userId: string, sources: string[]): Promise<Set<string>> {
  if (sources.length === 0) return new Set();
  const res = await sqlClient.execute({
    sql: `SELECT source FROM library_pass_grants WHERE user_id = ? AND source IN (${sources.map(() => "?").join(", ")})`,
    args: [userId, ...sources],
  });
  return new Set(res.rows.map((r) => r.source as string));
}

/** How many inviter-side invite bonuses a user has had since `sinceIso`. */
export async function inviterBonusesSince(userId: string, sinceIso: string): Promise<number> {
  const res = await sqlClient.execute({
    sql: "SELECT COUNT(*) AS n FROM library_pass_grants WHERE user_id = ? AND source LIKE 'invite:%:inviter' AND granted_at >= ?",
    args: [userId, sinceIso],
  });
  return Number(res.rows[0]?.n ?? 0);
}

async function passUntil(userId: string): Promise<string | null> {
  const r = await sqlClient.execute({ sql: "SELECT library_pass_until FROM users WHERE id = ? LIMIT 1", args: [userId] });
  return (r.rows[0]?.library_pass_until as string | null) ?? null;
}
