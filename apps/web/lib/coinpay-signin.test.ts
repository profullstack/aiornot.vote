/**
 * Sign in with CoinPay against a real (in-memory SQLite) database and a fake
 * CoinPay: accounts bind to the CoinPay sub only, an email collision never takes
 * over an existing account, linking needs the signed-in account that started
 * it, and a bad state or nonce is refused.
 */
import { createClient, type Client } from "@libsql/client";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  coinpayLinkFor,
  coinpayLoginChoices,
  chooseCoinPayLoginAccount,
  disconnectCoinPay,
  finishCoinPay,
  isPlaceholderEmail,
  startCoinPay,
} from "./coinpay-signin";

const BASE = "https://coinpay.test";
const oauth = { clientId: "cp_test", clientSecret: "secret", base: BASE };
const appUrl = "https://aiornot.test";
let db: Client;

let identity = { sub: "sub-1", email: "someone@example.com", name: "Some One" };
let nonceOverride: string | null = null;
let lastNonce = "";
const tokenBodies: URLSearchParams[] = [];

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.endsWith("/api/oauth/token")) {
    tokenBodies.push(new URLSearchParams(String(init?.body)));
    const idToken = [
      b64({ alg: "RS256" }),
      b64({ iss: BASE, aud: oauth.clientId, sub: identity.sub, exp: Math.floor(Date.now() / 1000) + 600, nonce: nonceOverride ?? lastNonce }),
      "sig",
    ].join(".");
    return Response.json({ access_token: "at", expires_in: 3600, id_token: idToken });
  }
  if (url.endsWith("/api/oauth/userinfo")) {
    return Response.json({ sub: identity.sub, email: identity.email, email_verified: false, name: identity.name });
  }
  return new Response("nope", { status: 404 });
}) as typeof fetch;

async function flow(mode: "login" | "link", opts: { sessionUserId?: string | null; startUserId?: string | null; cookie?: string | null } = {}) {
  const { url, state } = await startCoinPay(db, { mode, userId: opts.startUserId ?? null, appUrl, oauth });
  const authorize = new URL(url);
  lastNonce = authorize.searchParams.get("nonce")!;
  const params = new URLSearchParams({ code: "abc", state });
  return {
    authorize,
    outcome: await finishCoinPay(db, {
      params,
      cookieState: opts.cookie === undefined ? state : opts.cookie,
      sessionUserId: opts.sessionUserId ?? null,
      appUrl,
      oauth,
      fetch: fakeFetch,
    }),
  };
}

async function makeUser(id: string, email: string, password = true) {
  await db.execute({
    sql: `INSERT INTO users (id, email, email_normalized, password_hash, status, role, email_verified_at)
          VALUES (?, ?, ?, ?, 'active', 'user', CURRENT_TIMESTAMP)`,
    args: [id, email, email.toLowerCase(), password ? "hash" : null],
  });
}

beforeAll(async () => {
  db = createClient({ url: ":memory:" });
  await db.execute(`CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, email_normalized TEXT NOT NULL UNIQUE,
    email_verified_at TEXT, password_hash TEXT, display_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending_email_verification', role TEXT NOT NULL DEFAULT 'user',
    last_login_at TEXT, updated_at TEXT)`);
  await db.execute(`CREATE TABLE user_stats (user_id TEXT PRIMARY KEY)`);
  for (const migration of ["0020_coinpay_sign_in.sql", "0021_coinpay_multi_account.sql"]) {
    const sql = readFileSync(new URL(`../../../packages/db/migrations/${migration}`, import.meta.url), "utf8");
    for (const stmt of sql.split(/;\s*(?:\n|$)/).map((s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").trim()).filter(Boolean)) {
      await db.execute(stmt);
    }
  }
});

describe("Sign in with CoinPay", () => {
  it("starts with PKCE S256, state, nonce, the exact redirect and sign-in scopes", async () => {
    const { url, state } = await startCoinPay(db, { mode: "login", userId: null, appUrl, oauth });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe(`${BASE}/api/oauth/authorize`);
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    expect(u.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(u.searchParams.get("nonce")).toBeTruthy();
    expect(u.searchParams.get("state")).toBe(state);
    expect(u.searchParams.get("redirect_uri")).toBe(`${appUrl}/api/v1/coinpay/oauth/callback`);
    expect(u.searchParams.get("scope")).toBe("openid profile email");
  });

  it("a first sign-in makes a new account bound to the sub, with a placeholder email", async () => {
    identity = { sub: "sub-new", email: "fresh@example.com", name: "Fresh" };
    const { outcome } = await flow("login");
    expect(outcome).toMatchObject({ ok: true, kind: "welcome" });
    const userId = (outcome as { userId: string }).userId;
    const row = (await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [userId] })).rows[0]!;
    expect(isPlaceholderEmail(String(row.email))).toBe(true);
    expect(row.email_verified_at).toBeNull();
    expect(row.password_hash).toBeNull();
    expect(row.role).toBe("user");
    // The code exchange carried the verifier and the client secret.
    expect(tokenBodies.at(-1)!.get("code_verifier")).toBeTruthy();
    expect(tokenBodies.at(-1)!.get("client_secret")).toBe("secret");
    const again = await flow("login");
    expect(again.outcome).toEqual({ ok: true, kind: "signed_in", userId });
  });

  it("a CoinPay email equal to an existing account's email does NOT get that account", async () => {
    await makeUser("usr_victim", "victim@example.com");
    identity = { sub: "sub-attacker", email: "victim@example.com", name: "Attacker" };
    const { outcome } = await flow("login");
    expect(outcome.ok).toBe(true);
    expect((outcome as { userId: string }).userId).not.toBe("usr_victim");
    const linked = await db.execute({ sql: "SELECT 1 FROM coinpay_identities WHERE user_id = 'usr_victim'", args: [] });
    expect(linked.rows.length).toBe(0);
  });

  it("refuses a missing or mismatched browser state, and a replayed one", async () => {
    identity = { sub: "sub-state", email: "s@example.com", name: "S" };
    expect((await flow("login", { cookie: null })).outcome).toEqual({ ok: false, error: "bad_state" });
    expect((await flow("login", { cookie: "other" })).outcome).toEqual({ ok: false, error: "bad_state" });
    const { url, state } = await startCoinPay(db, { mode: "login", userId: null, appUrl, oauth });
    lastNonce = new URL(url).searchParams.get("nonce")!;
    const params = new URLSearchParams({ code: "abc", state });
    const first = await finishCoinPay(db, { params, cookieState: state, sessionUserId: null, appUrl, oauth, fetch: fakeFetch });
    expect(first.ok).toBe(true);
    const replay = await finishCoinPay(db, { params, cookieState: state, sessionUserId: null, appUrl, oauth, fetch: fakeFetch });
    expect(replay).toEqual({ ok: false, error: "bad_state" });
  });

  it("refuses an id_token with the wrong nonce", async () => {
    identity = { sub: "sub-nonce", email: "n@example.com", name: "N" };
    nonceOverride = "not-it";
    try {
      expect((await flow("login")).outcome).toEqual({ ok: false, error: "exchange_failed" });
    } finally {
      nonceOverride = null;
    }
    const made = await db.execute({ sql: "SELECT 1 FROM coinpay_identities WHERE sub = 'sub-nonce'", args: [] });
    expect(made.rows.length).toBe(0);
  });

  it("linking needs the signed-in account that started it", async () => {
    await makeUser("usr_linker", "linker@example.com");
    identity = { sub: "sub-linker", email: "other@example.com", name: "L" };
    // No session at the callback.
    expect((await flow("link", { startUserId: "usr_linker", sessionUserId: null })).outcome).toEqual({
      ok: false,
      error: "sign_in_first",
    });
    // A different session at the callback.
    expect((await flow("link", { startUserId: "usr_linker", sessionUserId: "usr_victim" })).outcome).toEqual({
      ok: false,
      error: "sign_in_first",
    });
    expect((await flow("link", { startUserId: "usr_linker", sessionUserId: "usr_linker" })).outcome).toEqual({
      ok: true,
      kind: "linked",
      userId: "usr_linker",
    });
    // Now CoinPay signs into that account.
    expect((await flow("login")).outcome).toEqual({ ok: true, kind: "signed_in", userId: "usr_linker" });
    // The same CoinPay identity can also be deliberately connected to another account.
    identity = { sub: "sub-new", email: "fresh@example.com", name: "Fresh" };
    await makeUser("usr_third", "third@example.com");
    expect((await flow("link", { startUserId: "usr_third", sessionUserId: "usr_third" })).outcome).toEqual({
      ok: true,
      kind: "linked",
      userId: "usr_third",
    });
    const accounts = await db.execute({ sql: "SELECT user_id FROM coinpay_identities WHERE sub = 'sub-new'", args: [] });
    expect(accounts.rows).toHaveLength(2);

    // A future CoinPay sign-in must ask which linked account is intended.
    const login = await flow("login");
    expect(login.outcome.ok && login.outcome.kind).toBe("choose_account");
    if (!login.outcome.ok || login.outcome.kind !== "choose_account") throw new Error("Expected a CoinPay account chooser");
    const choices = await coinpayLoginChoices(db, login.outcome.choiceToken);
    expect(choices).toHaveLength(2);
    expect(await chooseCoinPayLoginAccount(db, login.outcome.choiceToken, "usr_victim")).toBeNull();
    expect(await chooseCoinPayLoginAccount(db, login.outcome.choiceToken, "usr_third")).toBe("usr_third");
    expect(await chooseCoinPayLoginAccount(db, login.outcome.choiceToken, "usr_third")).toBeNull();
  });

  it("disconnect is refused when CoinPay is the only way in, allowed otherwise", async () => {
    expect(await coinpayLinkFor(db, "usr_linker")).toEqual({ linked: true, hasPassword: true });
    expect(await disconnectCoinPay(db, "usr_linker")).toBe("ok");
    const only = (await db.execute({ sql: "SELECT user_id FROM coinpay_identities WHERE sub = 'sub-new' AND user_id <> 'usr_third'", args: [] })).rows[0]!;
    expect(await disconnectCoinPay(db, String(only.user_id))).toBe("only_way_in");
  });
});
