import "server-only";
import { sqlClient } from "./db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: number };

let lastCleanup = 0;

/**
 * Fixed-window rate limiter backed by the database so limits hold across
 * multiple app instances (fixes #91). Each bucket row is updated atomically
 * via an upsert; expired windows reset in place. Call sites must `await`.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + windowMs;

  await sqlClient.execute({
    sql: `INSERT INTO rate_limits (bucket_key, bucket_count, reset_at)
          VALUES (?, 1, ?)
          ON CONFLICT(bucket_key) DO UPDATE SET
            bucket_count = CASE WHEN rate_limits.reset_at <= ? THEN 1 ELSE rate_limits.bucket_count + 1 END,
            reset_at     = CASE WHEN rate_limits.reset_at <= ? THEN ? ELSE rate_limits.reset_at END`,
    args: [key, resetAt, now, now, resetAt],
  });

  const r = await sqlClient.execute({
    sql: "SELECT bucket_count, reset_at FROM rate_limits WHERE bucket_key = ?",
    args: [key],
  });
  const row = r.rows[0];
  const count = Number(row?.bucket_count ?? 1);
  const effectiveResetAt = Number(row?.reset_at ?? resetAt);

  // Opportunistic cleanup (at most once a minute) so expired buckets don't
  // accumulate forever. Best-effort — never fail a request over cleanup.
  if (now - lastCleanup > 60_000) {
    lastCleanup = now;
    try {
      await sqlClient.execute({
        sql: "DELETE FROM rate_limits WHERE reset_at < ?",
        args: [now - 86_400_000],
      });
    } catch {
      /* ignore */
    }
  }

  return { ok: count <= limit, remaining: Math.max(0, limit - count), resetAt: effectiveResetAt };
}
