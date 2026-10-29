/**
 * Sign in with CoinPay (2026-10-29). CoinPay is the fleet's master account: a
 * CoinPay user can sign in here, and a signed-in user can connect their CoinPay
 * account to this one.
 *
 * Authorization code + PKCE (S256) + state + nonce as a confidential client.
 * The PKCE verifier and nonce stay server-side in a single-use row keyed by the
 * state's hash; the state is also pinned to the browser by an HttpOnly cookie
 * (login CSRF). Code exchange, id_token claim checks and userinfo come from
 * @profullstack/coinpay-onboard/oauth.
 *
 * STANDING rule: the account binds to the CoinPay `sub` only. CoinPay never
 * verifies email addresses, so the CoinPay email is contact information: never
 * matched against users.email_normalized, never stored as users.email, never a
 * reason for a role (ADMIN_EMAILS). A first CoinPay sign-in creates a new
 * account with a random, unroutable `.invalid` placeholder address; linking to
 * an existing account happens only from inside that account (mode "link").
 */
import type { Client } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import {
  authorizeUrl,
  finishSignIn,
  pkce,
  randomToken,
  sameState,
  SIGN_IN_SCOPES,
} from "@profullstack/coinpay-onboard/oauth";

export const STATE_COOKIE = "aon_coinpay_state";
export const CALLBACK_PATH = "/api/v1/coinpay/oauth/callback";
export const PLACEHOLDER_DOMAIN = "coinpay.aiornot.invalid";
const PENDING_TTL_MS = 10 * 60_000;

export type CoinPayOAuth = { clientId: string; clientSecret: string; base?: string };

/** Read at run time with a non-literal key: Next inlines process.env.NAME at build. */
export function coinpayOAuthConfig(env: Record<string, string | undefined> = process.env): CoinPayOAuth {
  const read = (key: string) => (env[key] ?? "").trim();
  return {
    clientId: read("COINPAY_OAUTH_CLIENT_ID"),
    clientSecret: read("COINPAY_OAUTH_CLIENT_SECRET"),
    base: read("COINPAY_OAUTH_BASE") || undefined,
  };
}

export const coinpayEnabled = (c: CoinPayOAuth) => Boolean(c.clientId && c.clientSecret);

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const iso = (ms: number) => new Date(ms).toISOString();

export function isPlaceholderEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

/** Start a sign-in (`login`) or a connect (`link`, needs the signed-in user). */
export async function startCoinPay(
  db: Client,
  input: { mode: "login" | "link"; userId: string | null; appUrl: string; oauth: CoinPayOAuth; now?: number },
): Promise<{ url: string; state: string }> {
  const now = input.now ?? Date.now();
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = pkce();
  await db.execute({ sql: "DELETE FROM coinpay_oauth_pending WHERE expires_at < ?", args: [iso(now)] });
  await db.execute({
    sql: `INSERT INTO coinpay_oauth_pending (state_hash, verifier, nonce, mode, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [sha256(state), verifier, nonce, input.mode, input.userId, iso(now), iso(now + PENDING_TTL_MS)],
  });
  const url = authorizeUrl({
    clientId: input.oauth.clientId,
    redirectUri: new URL(CALLBACK_PATH, input.appUrl).toString(),
    state,
    nonce,
    challenge,
    scopes: SIGN_IN_SCOPES,
    base: input.oauth.base,
  });
  return { url, state };
}

export type CallbackOutcome =
  | { ok: true; kind: "signed_in" | "welcome"; userId: string }
  | { ok: true; kind: "linked"; userId: string }
  | {
      ok: false;
      error:
        | "bad_state"
        | "denied"
        | "bad_request"
        | "exchange_failed"
        | "sign_in_first"
        | "linked_elsewhere"
        | "already_linked"
        | "unavailable";
    };

/** Finish a CoinPay authorization. The caller mints a session for signed_in/welcome. */
export async function finishCoinPay(
  db: Client,
  input: {
    params: URLSearchParams;
    cookieState: string | null | undefined;
    sessionUserId: string | null;
    appUrl: string;
    oauth: CoinPayOAuth;
    fetch?: typeof fetch;
    now?: number;
  },
): Promise<CallbackOutcome> {
  const now = input.now ?? Date.now();
  const state = input.params.get("state") ?? "";
  const code = input.params.get("code") ?? "";

  if (!sameState(input.cookieState, state)) return { ok: false, error: "bad_state" };
  const key = sha256(state);
  const rs = await db.execute({
    sql: "SELECT verifier, nonce, mode, user_id, expires_at FROM coinpay_oauth_pending WHERE state_hash = ?",
    args: [key],
  });
  const row = rs.rows[0];
  if (!row) return { ok: false, error: "bad_state" };
  const del = await db.execute({ sql: "DELETE FROM coinpay_oauth_pending WHERE state_hash = ?", args: [key] });
  if (Number(del.rowsAffected ?? 0) === 0) return { ok: false, error: "bad_state" };
  if (String(row.expires_at) < iso(now)) return { ok: false, error: "bad_state" };
  if (input.params.get("error")) return { ok: false, error: "denied" };
  if (!code) return { ok: false, error: "bad_request" };

  let identity: { sub: string; email: string | null; name: string | null };
  try {
    identity = await finishSignIn({
      code,
      verifier: String(row.verifier),
      nonce: String(row.nonce),
      clientId: input.oauth.clientId,
      clientSecret: input.oauth.clientSecret,
      redirectUri: new URL(CALLBACK_PATH, input.appUrl).toString(),
      base: input.oauth.base,
      fetch: input.fetch,
      now,
    });
  } catch (err) {
    console.error("[coinpay] sign-in failed:", (err as Error).message);
    return { ok: false, error: "exchange_failed" };
  }

  const bound = await db.execute({ sql: "SELECT user_id FROM coinpay_identities WHERE sub = ?", args: [identity.sub] });
  const existing = bound.rows[0] ? String(bound.rows[0].user_id) : null;

  if (String(row.mode) === "link") {
    // Only the signed-in account that started the link may finish it.
    if (!input.sessionUserId || input.sessionUserId !== String(row.user_id ?? "")) {
      return { ok: false, error: "sign_in_first" };
    }
    if (existing) {
      return existing === input.sessionUserId
        ? { ok: true, kind: "linked", userId: existing }
        : { ok: false, error: "linked_elsewhere" };
    }
    const mine = await db.execute({ sql: "SELECT 1 FROM coinpay_identities WHERE user_id = ?", args: [input.sessionUserId] });
    if (mine.rows.length) return { ok: false, error: "already_linked" };
    await db.execute({
      sql: `INSERT INTO coinpay_identities (sub, user_id, contact_email, name, created_at) VALUES (?, ?, ?, ?, ?)`,
      args: [identity.sub, input.sessionUserId, identity.email, identity.name, iso(now)],
    });
    return { ok: true, kind: "linked", userId: input.sessionUserId };
  }

  // Sign in: the sub alone decides the account. No email lookup, ever.
  if (existing) {
    const u = await db.execute({ sql: "SELECT status FROM users WHERE id = ?", args: [existing] });
    const status = u.rows[0]?.status;
    if (!u.rows[0] || status === "suspended" || status === "deleted") return { ok: false, error: "unavailable" };
    await db.execute({
      sql: "UPDATE coinpay_identities SET last_login_at = ?, contact_email = ?, name = COALESCE(?, name) WHERE sub = ?",
      args: [iso(now), identity.email, identity.name, identity.sub],
    });
    await db.execute({ sql: "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", args: [existing] });
    return { ok: true, kind: "signed_in", userId: existing };
  }

  const userId = `usr_${randomUUID().replace(/-/g, "")}`;
  const placeholder = `${userId.toLowerCase()}@${PLACEHOLDER_DOMAIN}`;
  // No password, unverified, role "user": a CoinPay account proves nothing
  // about an inbox and never earns a role.
  await db.execute({
    sql: `INSERT INTO users (id, email, email_normalized, password_hash, display_name, status, role)
          VALUES (?, ?, ?, NULL, NULL, 'active', 'user')`,
    args: [userId, placeholder, placeholder],
  });
  await db.execute({ sql: "INSERT INTO user_stats (user_id) VALUES (?) ON CONFLICT DO NOTHING", args: [userId] });
  await db.execute({
    sql: `INSERT INTO coinpay_identities (sub, user_id, contact_email, name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [identity.sub, userId, identity.email, identity.name, iso(now), iso(now)],
  });
  return { ok: true, kind: "welcome", userId };
}

export type CoinPayLink = { linked: boolean; hasPassword: boolean };

export async function coinpayLinkFor(db: Client, userId: string): Promise<CoinPayLink> {
  const rs = await db.execute({
    sql: `SELECT u.password_hash AS ph, c.sub AS sub FROM users u
          LEFT JOIN coinpay_identities c ON c.user_id = u.id WHERE u.id = ?`,
    args: [userId],
  });
  const row = rs.rows[0];
  return { linked: Boolean(row?.sub), hasPassword: Boolean(row?.ph) };
}

/** Disconnect; refused when CoinPay is the only way in (no password). */
export async function disconnectCoinPay(db: Client, userId: string): Promise<"ok" | "only_way_in"> {
  const link = await coinpayLinkFor(db, userId);
  if (!link.linked) return "ok";
  if (!link.hasPassword) return "only_way_in";
  await db.execute({ sql: "DELETE FROM coinpay_identities WHERE user_id = ?", args: [userId] });
  return "ok";
}
