import "server-only";
import { createRequire } from "node:module";
import pg from "pg";
import {
  Credits,
  postgresStore as creditsPostgres,
  sqliteStore as creditsSqlite,
  type CreditStore,
  type Grant,
} from "@profullstack/redeem-credits";
import {
  Affiliates,
  hashCode as inviteHash,
  normalizeCode as normalizeInvite,
  postgresStore as affiliatesPostgres,
  sqliteStore as affiliatesSqlite,
  type AffiliateStore,
} from "@profullstack/affiliates";
import { postgresPoolSettings, resolveUrl } from "@aiornot/db";
import { sqlClient } from "./db";
import { looksLikeInvite } from "./invite-code";
import { grantLibraryDaysOnce, grantedSources, inviterBonusesSince, MAX_GRANT_DAYS } from "./library-grants";

/**
 * Credit codes and scarce invites for aiornot.vote (server only).
 *
 * The one thing either can give is days of the photo library pass: the same
 * users.library_pass_until a paid $9 / 30-day pass extends (grantLibraryDaysOnce,
 * idempotent on (user, source)). No second balance, no parallel flag. The game's
 * photos are Unsplash and never for sale; a code or invite only opens /library
 * (contributor-licensed and Met CC0 photos).
 *
 * - A credit code (`CR-XXXX-XXXX-XXXX-XXXX`, @profullstack/redeem-credits) grants
 *   unit `library_days`. An admin mints it at /admin/credits; the holder redeems
 *   it under "Have a code?" on /account or with POST /api/credits/redeem.
 * - An invite (`INV-XXXX-XXXX-XXXX`, @profullstack/affiliates) is scarce:
 *   INVITE_QUOTA per account, single use, 30 days. A NEW account that signs up
 *   on one and verifies its email gets INVITE_BONUS_DAYS, and so does the
 *   inviter (at most INVITE_MONTHLY_CAP inviter bonuses a calendar month), once
 *   the new account passes the checks in inviteBlockReason.
 * - The old refer-a-friend link (/r/<code>, the aon_ref cookie, a prize coupon
 *   for the referrer) is untouched. A sign-up that holds an invite is not also
 *   recorded as a referral, and a referred account never takes an invite bonus,
 *   so one sign-up is counted once.
 *
 * Both packages' tables live in the site's own database (Postgres in
 * production, the local SQLite file in development), created by their stores.
 * Everything is built lazily: env is read at run time, never inlined at build.
 */

export const LIBRARY_DAYS_UNIT = "library_days";
const DAY_MS = 86_400_000;

function intEnv(name: string, def: number, min = 0, max = 3650): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "" || !/^\d+$/.test(raw.trim())) return def;
  const n = Number(raw);
  return n >= min && n <= max ? n : def;
}

/** Read at call time (process.env[name] with a non-literal key is never inlined). */
export const inviteConfig = {
  /** Invites each account may create; an admin can raise one user's with setQuota. */
  get quota() {
    return intEnv("INVITE_QUOTA", 3, 0, 1000);
  },
  /** Library days each side gets when an invited account qualifies. */
  get bonusDays() {
    return intEnv("INVITE_BONUS_DAYS", 7, 0, 365);
  },
  /** Inviter-side bonuses one account can collect in a calendar month (UTC). */
  get monthlyCap() {
    return intEnv("INVITE_MONTHLY_CAP", 3, 0, 1000);
  },
  /** An account must be this old (and verified) to hand out invites. */
  get minInviterAgeDays() {
    return intEnv("INVITE_MIN_ACCOUNT_AGE_DAYS", 3, 0, 365);
  },
  /** Only an account at most this old can collect an invite: invites are for new people. */
  get maxInviteeAgeDays() {
    return intEnv("INVITE_ACCEPT_MAX_ACCOUNT_AGE_DAYS", 7, 1, 365);
  },
  ttlDays: 30,
};

export { INVITE_COOKIE } from "./invite-code";

// ── services ─────────────────────────────────────────────────────────

export type CreditServices = { credits: Credits; aff: Affiliates };

let shared: CreditServices | null = null;

/** Credits + Affiliates over the site database, built on first use. */
export function services(): CreditServices {
  if (shared) return shared;
  const { creditStore, affiliateStore } = openStores();
  shared = makeServices(creditStore, affiliateStore);
  return shared;
}

/** Test hook. */
export function setServicesForTest(s: CreditServices | null) {
  shared = s;
}

export function makeServices(
  creditStore: CreditStore,
  affiliateStore: AffiliateStore,
  now?: () => number,
): CreditServices {
  const credits = new Credits(creditStore, {
    ...(now ? { now } : {}),
    onGrant: (userId: string, grant: Grant, source: string) => applyGrant(userId, grant, source),
  });
  const aff = new Affiliates(affiliateStore, {
    ...(now ? { now } : {}),
    defaultQuota: inviteConfig.quota,
    inviteTtlMs: inviteConfig.ttlDays * DAY_MS,
    // aiornot's open referral link is its own /r/<code>, not an aff_codes link,
    // so attribute() is never called and nothing is external.
  });
  return { credits, aff };
}

function openStores(): { creditStore: CreditStore; affiliateStore: AffiliateStore } {
  const settings = postgresPoolSettings();
  if (settings) {
    const pool = new pg.Pool({ ...(settings as pg.PoolConfig), max: 3, allowExitOnIdle: true });
    pool.on("error", () => {
      /* an idle connection dropped by the server; the next query reconnects */
    });
    return { creditStore: creditsPostgres(pool), affiliateStore: affiliatesPostgres(pool) };
  }
  // Local development on the `file:` SQLite database.
  const path = resolveUrl().slice("file:".length);
  const req = createRequire(import.meta.url);
  const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
  // Built at run time so no bundler tries to resolve a runtime-only module.
  const mod = isBun ? ["bun", "sqlite"].join(":") : ["node", "sqlite"].join(":");
  const m = req(mod) as { Database?: new (p: string) => unknown; DatabaseSync?: new (p: string) => unknown };
  const Ctor = (m.Database ?? m.DatabaseSync)!;
  const db = new Ctor(path) as Parameters<typeof creditsSqlite>[0] & Parameters<typeof affiliatesSqlite>[0];
  return { creditStore: creditsSqlite(db), affiliateStore: affiliatesSqlite(db) };
}

/** onGrant: mirror one committed redeem-credits grant into the library pass. */
export async function applyGrant(userId: string, grant: Grant, source: string): Promise<void> {
  if (grant.unit !== LIBRARY_DAYS_UNIT || grant.every) {
    // Only one-off library_days codes are minted here; anything else is a bug.
    console.error("[credits] grant with an unsupported unit ignored", { userId, unit: grant.unit, source });
    return;
  }
  const days = Math.trunc(grant.amount);
  if (days < 1) return;
  await grantLibraryDaysOnce(userId, days, source);
}

// ── credit codes ─────────────────────────────────────────────────────

export type RedeemFailure = "invalid" | "expired" | "used_up" | "already_redeemed" | "revoked";

export const REDEEM_MESSAGES: Record<RedeemFailure | "grant_failed", string> = {
  invalid: "That code is not one we issued. Check it and try again.",
  expired: "That code has expired.",
  used_up: "That code has already been used.",
  already_redeemed: "You have already redeemed that code.",
  revoked: "That code was withdrawn.",
  grant_failed: "The code was accepted but the library days did not save. Write to support@aiornot.vote and we will add them.",
};

/**
 * Re-apply any code grant whose library write did not land (the hook threw
 * after the redemption committed). Idempotent on (user, source).
 */
export async function repairCodeGrants(userId: string, svc: CreditServices = services()): Promise<number> {
  let fixed = 0;
  for (const e of await svc.credits.history(userId, LIBRARY_DAYS_UNIT)) {
    if (e.kind !== "grant" || !e.source.startsWith("code:")) continue;
    const days = Math.trunc(e.amount);
    if (days < 1 || days > MAX_GRANT_DAYS) continue;
    const r = await grantLibraryDaysOnce(userId, days, e.source);
    if (r.applied) fixed++;
  }
  return fixed;
}

export type RedeemResult =
  | { ok: true; days: number; until: string | null }
  | { ok: false; reason: RedeemFailure | "grant_failed"; error: string };

export async function redeemCode(userId: string, input: unknown, svc: CreditServices = services()): Promise<RedeemResult> {
  const code = String(input ?? "").trim();
  if (!code || code.length > 64) return { ok: false, reason: "invalid", error: REDEEM_MESSAGES.invalid };
  let r;
  try {
    r = await svc.credits.redeem(code, userId);
  } catch (err) {
    // The redemption stands (redeem-credits commits it before onGrant); the
    // days are re-applied by repairCodeGrants on the next attempt.
    console.error("[credits] grant after redeem failed:", (err as Error).message);
    return { ok: false, reason: "grant_failed", error: REDEEM_MESSAGES.grant_failed };
  }
  if (!r.ok) {
    if (r.reason === "already_redeemed") await repairCodeGrants(userId, svc).catch(() => 0);
    return { ok: false, reason: r.reason, error: REDEEM_MESSAGES[r.reason] };
  }
  const u = await sqlClient.execute({ sql: "SELECT library_pass_until FROM users WHERE id = ? LIMIT 1", args: [userId] });
  return { ok: true, days: r.grant.amount, until: (u.rows[0]?.library_pass_until as string | null) ?? null };
}

export type CodeOut = {
  code?: string;
  id: string;
  label: string;
  days: number;
  maxRedemptions: number;
  redemptions: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

export function codeOut(
  c: { id: string; label: string; grant: Grant; maxRedemptions: number; redemptions?: number; expiresAt: number | null; createdAt: number; revokedAt?: number | null },
  plaintext?: string,
): CodeOut {
  return {
    ...(plaintext ? { code: plaintext } : {}),
    id: c.id,
    label: c.label,
    days: c.grant.amount,
    maxRedemptions: c.maxRedemptions,
    redemptions: c.redemptions ?? 0,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    createdAt: new Date(c.createdAt).toISOString(),
    revokedAt: c.revokedAt ? new Date(c.revokedAt).toISOString() : null,
  };
}

function wholeIn(v: unknown, lo: number, hi: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
}

/** Admin: a code worth `days` of the library pass. The plaintext comes back once. */
export async function mintLibraryCode(
  o: { days: unknown; label?: unknown; maxRedemptions?: unknown; expiresInDays?: unknown; createdBy?: string },
  svc: CreditServices = services(),
): Promise<{ ok: true; code: CodeOut } | { ok: false; error: string }> {
  const days = wholeIn(o.days, 1, MAX_GRANT_DAYS);
  if (!days) return { ok: false, error: `Days must be a whole number from 1 to ${MAX_GRANT_DAYS}.` };
  const max = o.maxRedemptions === undefined || o.maxRedemptions === "" ? 1 : wholeIn(o.maxRedemptions, 1, 100_000);
  if (!max) return { ok: false, error: "Max redemptions must be from 1 to 100000." };
  let expiresAt: number | null = null;
  if (o.expiresInDays !== undefined && o.expiresInDays !== null && o.expiresInDays !== "") {
    const e = wholeIn(o.expiresInDays, 1, 3650);
    if (!e) return { ok: false, error: "Expiry must be from 1 to 3650 days." };
    expiresAt = Date.now() + e * DAY_MS;
  }
  const label = String(o.label ?? "").trim().slice(0, 120) || `${days} days of the photo library`;
  const minted = await svc.credits.mint({
    grant: { unit: LIBRARY_DAYS_UNIT, amount: days },
    label,
    maxRedemptions: max,
    expiresAt,
    createdBy: o.createdBy,
  });
  return { ok: true, code: codeOut(minted, minted.code) };
}

export async function listCodes(svc: CreditServices = services()): Promise<CodeOut[]> {
  return (await svc.credits.list()).map((c) => codeOut(c));
}

export async function revokeCode(id: string, svc: CreditServices = services()): Promise<boolean> {
  try {
    await svc.credits.revoke(id);
    return true;
  } catch {
    return false;
  }
}

// ── abuse checks ─────────────────────────────────────────────────────

/** Lowercase; for Gmail drop dots, and for everyone drop +tags, so aliases of one inbox match. */
export function canonicalEmail(email: string | null | undefined): string {
  const e = String(email ?? "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0] ?? local;
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** Throwaway inbox providers (the common ones; a fuller list can replace this). */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "sharklasers.com",
  "grr.la", "guerrillamailblock.com", "10minutemail.com", "10minutemail.net", "temp-mail.org",
  "tempmail.com", "tempmail.net", "tempmailo.com", "tempr.email", "temp-mail.io", "yopmail.com",
  "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.de", "trashmail.net", "getnada.com",
  "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com", "mintemail.com", "mohmal.com",
  "throwawaymail.com", "fakeinbox.com", "emailondeck.com", "mailcatch.com", "spamgourmet.com",
  "mytemp.email", "moakt.com", "burnermail.io", "discard.email", "inboxkitten.com", "tmail.ws",
  "tmpmail.org", "tmpmail.net", "1secmail.com", "1secmail.org", "1secmail.net", "emailfake.com",
  "fakemail.net", "mail.tm", "mailpoof.com", "spam4.me", "33mail.com", "anonaddy.me", "linshiyouxiang.net",
  "byom.de", "harakirimail.com", "mailsac.com", "mvrht.net", "getairmail.com", "dropmail.me",
]);

export function isDisposableEmail(email: string | null | undefined): boolean {
  const e = String(email ?? "").trim().toLowerCase();
  const domain = e.slice(e.lastIndexOf("@") + 1);
  if (!domain) return false;
  for (const d of DISPOSABLE_DOMAINS) if (domain === d || domain.endsWith(`.${d}`)) return true;
  return false;
}

type Account = {
  id: string;
  email: string;
  status: string;
  verified: boolean;
  createdAt: number;
  referredBy: string | null;
  pendingInvite: string | null;
};

async function account(userId: string): Promise<Account | null> {
  const r = await sqlClient.execute({
    sql: "SELECT id, email, status, email_verified_at, created_at, referred_by, pending_invite FROM users WHERE id = ? LIMIT 1",
    args: [userId],
  });
  const row = r.rows[0];
  if (!row) return null;
  const created = Date.parse(String(row.created_at ?? ""));
  return {
    id: row.id as string,
    email: row.email as string,
    status: row.status as string,
    verified: row.email_verified_at != null,
    createdAt: Number.isFinite(created) ? created : 0,
    referredBy: (row.referred_by as string | null) ?? null,
    pendingInvite: (row.pending_invite as string | null) ?? null,
  };
}

/** Another account (not `exceptId`) on the same inbox under an alias. */
async function aliasOfAnotherAccount(email: string, exceptId: string): Promise<boolean> {
  const canon = canonicalEmail(email);
  const domain = canon.slice(canon.lastIndexOf("@") + 1);
  const domains = domain === "gmail.com" ? ["gmail.com", "googlemail.com"] : [domain];
  const r = await sqlClient.execute({
    sql: `SELECT id, email_normalized FROM users
          WHERE id != ? AND (${domains.map(() => "email_normalized LIKE ?").join(" OR ")})`,
    args: [exceptId, ...domains.map((d) => `%@${d}`)],
  });
  return r.rows.some((row) => canonicalEmail(row.email_normalized as string) === canon);
}

/**
 * Why a just-verified account may not collect an invite bonus, or null. The
 * invite is left unused when this answers, so it still works for a real person.
 */
export async function inviteBlockReason(invitee: Account, inviter: Account | null, now = Date.now()): Promise<string | null> {
  if (!inviter) return "inviter gone";
  if (inviter.status !== "active" || !inviter.verified) return "inviter not active";
  if (invitee.status !== "active" || !invitee.verified) return "email not confirmed";
  if (invitee.referredBy) return "already referred";
  if (now - invitee.createdAt > inviteConfig.maxInviteeAgeDays * DAY_MS) return "not a new account";
  if (isDisposableEmail(invitee.email)) return "disposable email";
  if (canonicalEmail(invitee.email) === canonicalEmail(inviter.email)) return "same inbox as the inviter";
  if (await aliasOfAnotherAccount(invitee.email, invitee.id)) return "alias of another account";
  return null;
}

// ── invites ──────────────────────────────────────────────────────────

export const INVITE_MESSAGES = {
  invalid: "That invite is not one we issued.",
  expired: "That invite has expired.",
  used: "That invite has already been used.",
  self: "You cannot accept your own invite.",
  revoked: "That invite was withdrawn.",
  already_invited: "This account already joined on an invite.",
} as const;

export type InviteStatus = "ok" | "invalid" | "expired" | "used" | "revoked";

export { looksLikeInvite };
export const canonicalInvite = (s: string): string => normalizeInvite(s);

/** What an invite is, without spending it. */
export async function inviteStatus(code: unknown, svc: CreditServices = services()): Promise<InviteStatus> {
  if (!looksLikeInvite(code)) return "invalid";
  const row = await svc.aff.store.getInviteByHash(inviteHash(code));
  if (!row) return "invalid";
  if (row.revokedAt !== null) return "revoked";
  if (row.usedBy !== null) return "used";
  if (row.expiresAt !== null && Date.now() >= row.expiresAt) return "expired";
  return "ok";
}

async function inviterOf(code: string, svc: CreditServices): Promise<string | null> {
  const row = await svc.aff.store.getInviteByHash(inviteHash(code));
  return row?.inviterId ?? null;
}

export type InviteOut = {
  id: string;
  code?: string;
  url?: string;
  note: string;
  status: "open" | "used" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  bonus?: "granted" | "none";
};

function inviteOut(
  i: { id: string; note: string; createdAt: number; expiresAt: number | null; usedBy: string | null; usedAt: number | null; revokedAt?: number | null },
  plaintext?: string,
  origin?: string,
): InviteOut {
  const status: InviteOut["status"] =
    i.usedBy !== null ? "used" : i.revokedAt ? "revoked" : i.expiresAt !== null && Date.now() >= i.expiresAt ? "expired" : "open";
  return {
    id: i.id,
    ...(plaintext ? { code: plaintext, url: `${origin ?? ""}/i/${plaintext}` } : {}),
    note: i.note ?? "",
    status,
    createdAt: new Date(i.createdAt).toISOString(),
    expiresAt: i.expiresAt ? new Date(i.expiresAt).toISOString() : null,
    usedAt: i.usedAt ? new Date(i.usedAt).toISOString() : null,
  };
}

export async function myInvites(userId: string, svc: CreditServices = services()) {
  const [quota, raw] = await Promise.all([svc.aff.quota(userId), svc.aff.invites(userId)]);
  const granted = await grantedSources(
    userId,
    raw.filter((i) => i.usedBy).map((i) => `invite:${i.id}:inviter`),
  );
  const invites = raw.map((i) => ({
    ...inviteOut(i),
    ...(i.usedBy ? { bonus: granted.has(`invite:${i.id}:inviter`) ? ("granted" as const) : ("none" as const) } : {}),
  }));
  return { quota, invites, bonusDays: inviteConfig.bonusDays, canInvite: await inviterBlockReason(userId) };
}

/** Why this account may not hand out invites yet, or null. */
export async function inviterBlockReason(userId: string, now = Date.now()): Promise<string | null> {
  const a = await account(userId);
  if (!a || a.status !== "active") return "This account is not active.";
  if (!a.verified) return "Verify your email before inviting anyone.";
  const min = inviteConfig.minInviterAgeDays;
  if (now - a.createdAt < min * DAY_MS) return `Invites open once your account is ${min} days old.`;
  return null;
}

export async function createInvite(
  userId: string,
  note: unknown,
  origin: string,
  svc: CreditServices = services(),
): Promise<{ ok: true; invite: InviteOut } | { ok: false; error: string }> {
  const blocked = await inviterBlockReason(userId);
  if (blocked) return { ok: false, error: blocked };
  try {
    const made = await svc.aff.createInvite(userId, String(note ?? "").trim().slice(0, 80));
    return { ok: true, invite: inviteOut(made, made.code, origin) };
  } catch (err) {
    if (/no invites left/i.test((err as Error).message)) {
      return { ok: false, error: "No invites left. Each account gets a few; they are meant to be scarce." };
    }
    throw err;
  }
}

/** Withdraw one of MY unused invites. Someone else's id answers like an unknown one. */
export async function revokeInvite(userId: string, inviteId: string, svc: CreditServices = services()) {
  const mine = await svc.aff.invites(userId);
  const invite = mine.find((i) => i.id === inviteId);
  if (!invite) return { ok: false as const, error: "No such invite." };
  if (invite.usedBy !== null) return { ok: false as const, error: "That invite was already used." };
  await svc.aff.revokeInvite(invite.id);
  return { ok: true as const };
}

/**
 * At signup: keep a usable invite on the new account until its email is
 * verified (users.pending_invite), so the verification link counts in any
 * browser. Returns true when held; the caller then does not also record a
 * /r/ referral for this sign-up.
 */
export async function holdInviteOnSignup(userId: string, code: unknown, svc: CreditServices = services()): Promise<boolean> {
  if (!looksLikeInvite(code)) return false;
  if ((await inviteStatus(code, svc)) !== "ok") return false;
  const canonical = canonicalInvite(code);
  if ((await inviterOf(canonical, svc)) === userId) return false;
  const r = await sqlClient.execute({
    sql: "UPDATE users SET pending_invite = ? WHERE id = ? AND email_verified_at IS NULL",
    args: [canonical, userId],
  });
  return r.rowsAffected === 1;
}

export type AcceptResult =
  | { ok: true; inviteId: string; inviterId: string; inviteeDays: number; inviterDays: number }
  | { ok: false; reason: string };

/**
 * On the FIRST email verification of an account: accept the invite it signed
 * up with and give both people their library days. Never runs for an existing
 * account, so a member cannot collect bonuses by opening invites.
 */
export async function acceptPendingInvite(userId: string, svc: CreditServices = services(), now = Date.now()): Promise<AcceptResult> {
  const invitee = await account(userId);
  if (!invitee?.pendingInvite) return { ok: false, reason: "no invite" };
  const code = invitee.pendingInvite;
  // Claim the held code first so a double verify cannot run this twice.
  const claim = await sqlClient.execute({
    sql: "UPDATE users SET pending_invite = NULL WHERE id = ? AND pending_invite = ?",
    args: [userId, code],
  });
  if (claim.rowsAffected !== 1) return { ok: false, reason: "no invite" };

  const inviterId = await inviterOf(code, svc);
  const inviter = inviterId ? await account(inviterId) : null;
  const blocked = await inviteBlockReason(invitee, inviter, now);
  if (blocked) {
    console.warn(`[invite] ${userId} not credited: ${blocked}`);
    return { ok: false, reason: blocked };
  }
  const r = await svc.aff.redeemInvite(code, userId);
  if (!r.ok) return { ok: false, reason: r.reason };

  const days = inviteConfig.bonusDays;
  let inviteeDays = 0;
  let inviterDays = 0;
  if (days > 0) {
    if ((await grantLibraryDaysOnce(userId, days, `invite:${r.inviteId}:invitee`)).applied) inviteeDays = days;
    const monthStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)).toISOString();
    if ((await inviterBonusesSince(r.inviterId, monthStart)) < inviteConfig.monthlyCap) {
      if ((await grantLibraryDaysOnce(r.inviterId, days, `invite:${r.inviteId}:inviter`)).applied) inviterDays = days;
    } else {
      console.warn(`[invite] inviter ${r.inviterId} at the monthly cap; invitee credited only`);
    }
  }
  return { ok: true, inviteId: r.inviteId, inviterId: r.inviterId, inviteeDays, inviterDays };
}
