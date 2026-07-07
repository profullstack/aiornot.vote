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

/** Grant the one-time play pass (idempotent — first grant wins the timestamp). */
export async function grantPlayPass(userId: string): Promise<void> {
  await sqlClient.execute({
    sql: "UPDATE users SET play_pass_at = COALESCE(play_pass_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [userId],
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PromoQuote =
  | { ok: true; code: string; percentOff: number; baseUsd: number; finalUsd: number; free: boolean }
  | { ok: false; error: string };

/**
 * Validate a promo code against a purchase and compute the discounted price.
 * Does NOT mutate anything — pricing only. One redemption per user per code;
 * respects active flag, applies_to (which product) and max_uses.
 */
export async function quotePromo(
  userId: string,
  codeRaw: string,
  purpose: string,
  baseUsd: number,
): Promise<PromoQuote> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a code." };
  const r = await sqlClient.execute({
    sql: "SELECT code, percent_off, applies_to, active, max_uses, uses FROM promo_codes WHERE code = ? LIMIT 1",
    args: [code],
  });
  const row = r.rows[0];
  if (!row || Number(row.active) !== 1) return { ok: false, error: "That code isn't valid right now." };
  const appliesTo = (row.applies_to as string) || "any";
  if (appliesTo !== "any" && appliesTo !== purpose) {
    return { ok: false, error: "That code doesn't apply to this purchase." };
  }
  if (row.max_uses != null && Number(row.uses) >= Number(row.max_uses)) {
    return { ok: false, error: "This code has been fully redeemed." };
  }
  const dup = await sqlClient.execute({
    sql: "SELECT 1 FROM promo_redemptions WHERE code = ? AND user_id = ? LIMIT 1",
    args: [code, userId],
  });
  if (dup.rows[0]) return { ok: false, error: "You've already used this code." };

  const percentOff = Math.min(100, Math.max(1, Number(row.percent_off ?? 100)));
  const finalUsd = round2(baseUsd * (1 - percentOff / 100));
  return { ok: true, code, percentOff, baseUsd, finalUsd, free: finalUsd <= 0 };
}

/** Record a promo redemption (idempotent). Call once the discount is actually granted. */
export async function recordPromoRedemption(codeRaw: string, userId: string): Promise<void> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return;
  try {
    await sqlClient.execute({ sql: "INSERT INTO promo_redemptions (code, user_id) VALUES (?, ?)", args: [code, userId] });
    await sqlClient.execute({ sql: "UPDATE promo_codes SET uses = uses + 1 WHERE code = ?", args: [code] });
  } catch {
    /* already recorded — composite PK makes this a no-op */
  }
}

/** Apply the entitlement for a purpose directly (used for 100%-off comps). */
export async function grantPurpose(userId: string, purpose: string): Promise<GrantResult> {
  return grantForPayment({ id: newId("pay"), userId, purpose });
}

export type PromoCode = {
  code: string;
  percentOff: number;
  appliesTo: string;
  active: boolean;
  maxUses: number | null;
  uses: number;
  note: string | null;
};

export async function listPromoCodes(): Promise<PromoCode[]> {
  const r = await sqlClient.execute(
    "SELECT code, percent_off, applies_to, active, max_uses, uses, note FROM promo_codes ORDER BY created_at DESC",
  );
  return r.rows.map((x) => ({
    code: x.code as string,
    percentOff: Number(x.percent_off ?? 100),
    appliesTo: (x.applies_to as string) || "any",
    active: Number(x.active) === 1,
    maxUses: x.max_uses == null ? null : Number(x.max_uses),
    uses: Number(x.uses),
    note: (x.note as string) ?? null,
  }));
}

export async function setPromoActive(code: string, active: boolean): Promise<void> {
  await sqlClient.execute({ sql: "UPDATE promo_codes SET active = ? WHERE code = ?", args: [active ? 1 : 0, code.trim().toUpperCase()] });
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
  if (payment.purpose === "play_pass") {
    await grantPlayPass(payment.userId);
    return {};
  }
  if (payment.purpose === "api_access") {
    const key = await createApiKey(payment.userId, "API access");
    return { apiKeyPlaintext: key.plaintext };
  }
  return {};
}
