import "server-only";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { randomToken, hmac } from "./crypto";

const API_KEY_SALT = "aiornot-api-key";

export type ApiKeyRow = {
  id: string;
  prefix: string;
  label: string | null;
  isActive: boolean;
  requestCount: number;
  lastUsedAt: string | null;
  createdAt: string;
};

/** Create an API key. The plaintext is returned once and never stored. */
export async function createApiKey(
  userId: string,
  label?: string,
): Promise<{ plaintext: string; id: string; prefix: string }> {
  const secret = randomToken(24);
  const plaintext = `aion_live_${secret}`;
  const prefix = plaintext.slice(0, 16);
  const id = newId("key");
  await sqlClient.execute({
    sql: `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, label)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, userId, hmac(plaintext, API_KEY_SALT), prefix, label?.slice(0, 60) || null],
  });
  return { plaintext, id, prefix };
}

export async function listApiKeys(userId: string): Promise<ApiKeyRow[]> {
  const res = await sqlClient.execute({
    sql: `SELECT id, key_prefix, label, is_active, request_count, last_used_at, created_at
          FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
    args: [userId],
  });
  return res.rows.map((r) => ({
    id: r.id as string,
    prefix: r.key_prefix as string,
    label: (r.label as string) ?? null,
    isActive: Number(r.is_active) === 1,
    requestCount: Number(r.request_count ?? 0),
    lastUsedAt: (r.last_used_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  await sqlClient.execute({
    sql: "UPDATE api_keys SET is_active = 0 WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
}

/** Verify a raw API key from an Authorization header. Bumps usage counters. */
export async function verifyApiKey(
  rawKey: string,
): Promise<{ userId: string; keyId: string } | null> {
  if (!rawKey || !rawKey.startsWith("aion_")) return null;
  const res = await sqlClient.execute({
    sql: "SELECT id, user_id FROM api_keys WHERE key_hash = ? AND is_active = 1 LIMIT 1",
    args: [hmac(rawKey, API_KEY_SALT)],
  });
  const row = res.rows[0];
  if (!row) return null;
  await sqlClient.execute({
    sql: "UPDATE api_keys SET request_count = request_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [row.id],
  });
  return { userId: row.user_id as string, keyId: row.id as string };
}

export async function grantMembership(userId: string): Promise<void> {
  await sqlClient.execute({
    sql: "UPDATE users SET is_lifetime_member = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [userId],
  });
}

export type GrantResult = { apiKeyPlaintext?: string };

/**
 * Apply the entitlement for a paid payment row. Idempotent: the caller marks the
 * payment 'granted' so this only runs once. Returns a fresh API key plaintext
 * for api_access purchases (shown to the buyer exactly once).
 */
export async function grantForPayment(payment: {
  id: string;
  userId: string;
  purpose: string;
}): Promise<GrantResult> {
  if (payment.purpose === "lifetime_membership") {
    await grantMembership(payment.userId);
    return {};
  }
  if (payment.purpose === "api_access") {
    const key = await createApiKey(payment.userId, "API access");
    return { apiKeyPlaintext: key.plaintext };
  }
  return {};
}
