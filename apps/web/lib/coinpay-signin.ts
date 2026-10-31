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
import { resolveCoinPayAccountLink, resolveCoinPaySignIn } from "@profullstack/coinpay-onboard/identity";

export const STATE_COOKIE = "aon_coinpay_state";
export const CHOICE_COOKIE = "aon_coinpay_choice";
export const CALLBACK_PATH = "/api/v1/coinpay/oauth/callback";
export const PLACEHOLDER_DOMAIN = "coinpay.aiornot.invalid";
const PENDING_TTL_MS = 10 * 60_000;
const CHOICE_TTL_MS = 10 * 60_000;

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
  | { ok: true; kind: "choose_account"; choiceToken: string }
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

  if (String(row.mode) === "link") {
    // Only the signed-in account that started the link may finish it.
    if (!input.sessionUserId || input.sessionUserId !== String(row.user_id ?? "")) {
      return { ok: false, error: "sign_in_first" };
    }
    const relevant = await db.execute({
      sql: "SELECT sub, user_id FROM coinpay_identities WHERE sub = ? OR user_id = ?",
      args: [identity.sub, input.sessionUserId],
    });
    const decision = resolveCoinPayAccountLink({
      bindings: relevant.rows.map((binding) => ({ sub: String(binding.sub), userId: String(binding.user_id) })),
      sub: identity.sub,
      userId: input.sessionUserId,
    });
    if (decision.kind === "already_linked") return { ok: true, kind: "linked", userId: input.sessionUserId };
    if (decision.kind === "account_has_other_identity") return { ok: false, error: "already_linked" };
    await db.execute({
      sql: `INSERT INTO coinpay_identities (sub, user_id, contact_email, name, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      args: [identity.sub, input.sessionUserId, identity.email, identity.name, iso(now)],
    });
    const linked = await db.execute({ sql: "SELECT sub FROM coinpay_identities WHERE user_id = ?", args: [input.sessionUserId] });
    return String(linked.rows[0]?.sub ?? "") === identity.sub
      ? { ok: true, kind: "linked", userId: input.sessionUserId }
      : { ok: false, error: "already_linked" };
  }

  // Sign in by sub only. If the person connected several local accounts, ask
  // them to choose rather than silently selecting an account. Never use email.
  const bound = await db.execute({
    sql: `SELECT c.user_id, u.status FROM coinpay_identities c
          LEFT JOIN users u ON u.id = c.user_id WHERE c.sub = ? ORDER BY c.created_at, c.user_id`,
    args: [identity.sub],
  });
  const availableUserIds = bound.rows
    .filter((binding) => binding.status !== null && binding.status !== "suspended" && binding.status !== "deleted")
    .map((binding) => String(binding.user_id));
  if (bound.rows.length && !availableUserIds.length) return { ok: false, error: "unavailable" };
  const signIn = resolveCoinPaySignIn(availableUserIds);
  if (signIn.kind === "choose_account") {
    const choiceToken = randomToken();
    await db.execute({ sql: "DELETE FROM coinpay_login_choices WHERE expires_at < ?", args: [iso(now)] });
    await db.execute({
      sql: "INSERT INTO coinpay_login_choices (token_hash, sub, created_at, expires_at) VALUES (?, ?, ?, ?)",
      args: [sha256(choiceToken), identity.sub, iso(now), iso(now + CHOICE_TTL_MS)],
    });
    return { ok: true, kind: "choose_account", choiceToken };
  }
  if (signIn.kind === "sign_in") {
    const existing = signIn.userId;
    await db.execute({
      sql: "UPDATE coinpay_identities SET last_login_at = ?, contact_email = ?, name = COALESCE(?, name) WHERE sub = ? AND user_id = ?",
      args: [iso(now), identity.email, identity.name, identity.sub, existing],
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

export type CoinPayLoginChoice = { userId: string; label: string };

/** Return choices only while a valid, unexpired, HttpOnly-cookie ticket exists. */
export async function coinpayLoginChoices(db: Client, token: string | null | undefined, now = Date.now()): Promise<CoinPayLoginChoice[] | null> {
  if (!token) return null;
  const ticket = await db.execute({
    sql: "SELECT sub FROM coinpay_login_choices WHERE token_hash = ? AND expires_at > ?",
    args: [sha256(token), iso(now)],
  });
  const sub = ticket.rows[0]?.sub;
  if (!sub) return null;
  const rows = await db.execute({
    sql: `SELECT u.id, u.email, u.display_name FROM coinpay_identities c
          JOIN users u ON u.id = c.user_id
          WHERE c.sub = ? AND u.status NOT IN ('suspended', 'deleted')
          ORDER BY c.created_at, c.user_id`,
    args: [String(sub)],
  });
  return rows.rows.map((row) => {
    const id = String(row.id);
    const displayName = typeof row.display_name === "string" ? row.display_name.trim() : "";
    const email = String(row.email ?? "");
    const label = displayName || (isPlaceholderEmail(email) ? `AIorNot account · ${id.slice(-6)}` : email);
    return { userId: id, label };
  });
}

/** Consume a choice ticket once and return the selected linked local account. */
export async function chooseCoinPayLoginAccount(
  db: Client,
  token: string | null | undefined,
  userId: string,
  now = Date.now(),
): Promise<string | null> {
  if (!token || !userId) return null;
  const hash = sha256(token);
  const ticket = await db.execute({
    sql: "SELECT sub FROM coinpay_login_choices WHERE token_hash = ? AND expires_at > ?",
    args: [hash, iso(now)],
  });
  const sub = ticket.rows[0]?.sub;
  if (!sub) return null;
  const account = await db.execute({
    sql: `SELECT u.id FROM coinpay_identities c JOIN users u ON u.id = c.user_id
          WHERE c.sub = ? AND c.user_id = ? AND u.status NOT IN ('suspended', 'deleted')`,
    args: [String(sub), userId],
  });
  if (!account.rows[0]) return null;
  const consumed = await db.execute({
    sql: "DELETE FROM coinpay_login_choices WHERE token_hash = ? AND expires_at > ?",
    args: [hash, iso(now)],
  });
  if (Number(consumed.rowsAffected ?? 0) !== 1) return null;
  await db.execute({
    sql: "UPDATE coinpay_identities SET last_login_at = ? WHERE sub = ? AND user_id = ?",
    args: [iso(now), String(sub), userId],
  });
  await db.execute({ sql: "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", args: [userId] });
  return userId;
}

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
