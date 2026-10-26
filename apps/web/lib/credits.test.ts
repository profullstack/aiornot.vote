import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { memoryStore as creditMemory } from "@profullstack/redeem-credits";
import { memoryStore as affiliateMemory } from "@profullstack/affiliates";

vi.mock("server-only", () => ({}));

// A real SQLite file (transactions need a file, not :memory:) with the columns
// this feature touches, standing in for the site database.
const dir = mkdtempSync(join(tmpdir(), "aon-credits-"));
const holder = vi.hoisted(() => ({ db: null as unknown as Client }));
vi.mock("./db", () => ({
  sqlClient: new Proxy({} as Client, {
    get: (_t, prop) => {
      const v = (holder.db as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(holder.db) : v;
    },
  }),
}));
vi.mock("@aiornot/db", () => ({ postgresPoolSettings: () => null, resolveUrl: () => "file::memory:" }));

import {
  acceptPendingInvite,
  canonicalEmail,
  createInvite,
  holdInviteOnSignup,
  inviteStatus,
  isDisposableEmail,
  makeServices,
  mintLibraryCode,
  myInvites,
  redeemCode,
  setServicesForTest,
  type CreditServices,
} from "./credits";
import { grantLibraryDaysOnce } from "./library-grants";

const DAY = 86_400_000;
let svc: CreditServices;

async function addUser(id: string, email: string, o: { verified?: boolean; ageDays?: number; status?: string } = {}) {
  const created = new Date(Date.now() - (o.ageDays ?? 0) * DAY).toISOString();
  await holder.db.execute({
    sql: `INSERT INTO users (id, email, email_normalized, email_verified_at, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, email, email.toLowerCase(), o.verified === false ? null : created, o.status ?? (o.verified === false ? "pending_email_verification" : "active"), created],
  });
}
async function verify(id: string) {
  await holder.db.execute({
    sql: "UPDATE users SET email_verified_at = ?, status = 'active' WHERE id = ?",
    args: [new Date().toISOString(), id],
  });
}
async function until(id: string): Promise<string | null> {
  const r = await holder.db.execute({ sql: "SELECT library_pass_until FROM users WHERE id = ?", args: [id] });
  return (r.rows[0]?.library_pass_until as string | null) ?? null;
}
const daysLeft = async (id: string) => {
  const u = await until(id);
  return u ? Math.round((Date.parse(u) - Date.now()) / DAY) : 0;
};

beforeAll(async () => {
  holder.db = createClient({ url: `file:${join(dir, "t.db")}` });
});
afterAll(() => {
  holder.db.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await holder.db.execute("DROP TABLE IF EXISTS users");
  await holder.db.execute("DROP TABLE IF EXISTS library_pass_grants");
  await holder.db.execute(`CREATE TABLE users (
    id TEXT PRIMARY KEY, email TEXT, email_normalized TEXT, email_verified_at TEXT, status TEXT,
    created_at TEXT, updated_at TEXT, referred_by TEXT, pending_invite TEXT, library_pass_until TEXT)`);
  await holder.db.execute(`CREATE TABLE library_pass_grants (
    user_id TEXT NOT NULL, source TEXT NOT NULL, days INTEGER NOT NULL, granted_at TEXT NOT NULL,
    PRIMARY KEY (user_id, source))`);
  svc = makeServices(creditMemory(), affiliateMemory());
  setServicesForTest(svc);
});

describe("credit codes grant library pass days", () => {
  it("mints, redeems once, and extends the same pass a payment does", async () => {
    await addUser("u1", "one@example.com");
    const m = await mintLibraryCode({ days: 30, label: "Preshy" });
    expect(m.ok).toBe(true);
    const code = m.ok ? m.code.code! : "";
    expect(code).toMatch(/^CR-/);

    const r = await redeemCode("u1", code.toLowerCase().replace(/-/g, " "));
    expect(r).toMatchObject({ ok: true, days: 30 });
    expect(await daysLeft("u1")).toBe(30);

    expect(await redeemCode("u1", code)).toMatchObject({ ok: false, reason: "already_redeemed" });
    expect(await daysLeft("u1")).toBe(30);

    await addUser("u2", "two@example.com");
    expect(await redeemCode("u2", code)).toMatchObject({ ok: false, reason: "used_up" });
    expect(await redeemCode("u2", "CR-NOPE-NOPE-NOPE-NOPE")).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("stacks on a live pass", async () => {
    await addUser("u1", "one@example.com");
    await holder.db.execute({ sql: "UPDATE users SET library_pass_until = ? WHERE id = 'u1'", args: [new Date(Date.now() + 10 * DAY).toISOString()] });
    const m = await mintLibraryCode({ days: 5 });
    await redeemCode("u1", m.ok ? m.code.code : "");
    expect(await daysLeft("u1")).toBe(15);
  });

  it("refuses silly mints", async () => {
    expect((await mintLibraryCode({ days: 0 })).ok).toBe(false);
    expect((await mintLibraryCode({ days: 1.5 })).ok).toBe(false);
    expect((await mintLibraryCode({ days: 5, maxRedemptions: 0 })).ok).toBe(false);
  });

  it("grants are idempotent per (user, source)", async () => {
    await addUser("u1", "one@example.com");
    expect((await grantLibraryDaysOnce("u1", 7, "code:x")).applied).toBe(true);
    expect((await grantLibraryDaysOnce("u1", 7, "code:x")).applied).toBe(false);
    expect(await daysLeft("u1")).toBe(7);
  });
});

describe("invites", () => {
  async function inviteFrom(inviter: string) {
    const r = await createInvite(inviter, "for a friend", "https://aiornot.vote", svc);
    if (!r.ok) throw new Error(r.error);
    return r.invite.code!;
  }

  it("a new verified account on an invite gives both sides the bonus, once", async () => {
    await addUser("alice", "alice@example.com", { ageDays: 10 });
    const code = await inviteFrom("alice");
    expect(await inviteStatus(code)).toBe("ok");

    await addUser("carol", "carol@example.org", { verified: false });
    expect(await holdInviteOnSignup("carol", code)).toBe(true);
    await verify("carol");
    const r = await acceptPendingInvite("carol");
    expect(r).toMatchObject({ ok: true, inviterId: "alice", inviteeDays: 7, inviterDays: 7 });
    expect(await daysLeft("carol")).toBe(7);
    expect(await daysLeft("alice")).toBe(7);
    expect(await inviteStatus(code)).toBe("used");

    // A second verify finds nothing held.
    expect(await acceptPendingInvite("carol")).toMatchObject({ ok: false, reason: "no invite" });
    const mine = await myInvites("alice");
    expect(mine.quota).toEqual({ total: 3, used: 1, left: 2 });
    expect(mine.invites[0]).toMatchObject({ status: "used", bonus: "granted" });
  });

  it("is not held for a verified account or the inviter, nor for a junk code", async () => {
    await addUser("alice", "alice@example.com", { ageDays: 10 });
    const code = await inviteFrom("alice");
    await addUser("bob", "bob@example.com");
    expect(await holdInviteOnSignup("bob", code)).toBe(false);
    expect(await holdInviteOnSignup("alice", code)).toBe(false);
    await addUser("dan", "dan@example.com", { verified: false });
    expect(await holdInviteOnSignup("dan", "INV-0000-0000-0000")).toBe(false);
  });

  it("holds the bonus and keeps the invite for disposable, alias or old accounts", async () => {
    await addUser("alice", "alice.smith@gmail.com", { ageDays: 10 });
    const code = await inviteFrom("alice");

    await addUser("t1", "x@mailinator.com", { verified: false });
    await holdInviteOnSignup("t1", code);
    await verify("t1");
    expect(await acceptPendingInvite("t1")).toMatchObject({ ok: false, reason: "disposable email" });

    await addUser("t2", "AliceSmith+2@googlemail.com", { verified: false });
    await holdInviteOnSignup("t2", code);
    await verify("t2");
    expect(await acceptPendingInvite("t2")).toMatchObject({ ok: false, reason: "same inbox as the inviter" });

    await addUser("t3", "old@example.com", { verified: false, ageDays: 30 });
    await holdInviteOnSignup("t3", code);
    await verify("t3");
    expect(await acceptPendingInvite("t3")).toMatchObject({ ok: false, reason: "not a new account" });

    expect(await inviteStatus(code)).toBe("ok");
    expect(await daysLeft("alice")).toBe(0);
  });

  it("a referred account never also takes an invite bonus", async () => {
    await addUser("alice", "alice@example.com", { ageDays: 10 });
    const code = await inviteFrom("alice");
    await addUser("e", "e@example.com", { verified: false });
    await holdInviteOnSignup("e", code);
    await holder.db.execute("UPDATE users SET referred_by = 'someone' WHERE id = 'e'");
    await verify("e");
    expect(await acceptPendingInvite("e")).toMatchObject({ ok: false, reason: "already referred" });
  });

  it("a young account cannot hand out invites", async () => {
    await addUser("young", "young@example.com", { ageDays: 1 });
    expect(await createInvite("young", "", "https://aiornot.vote", svc)).toMatchObject({ ok: false });
    await addUser("pending", "p@example.com", { verified: false, ageDays: 10 });
    expect(await createInvite("pending", "", "https://aiornot.vote", svc)).toMatchObject({ ok: false });
  });

  it("caps the inviter's bonuses per month, the invitee still gets theirs", async () => {
    await addUser("alice", "alice@example.com", { ageDays: 10 });
    await svc.aff.setQuota("alice", 10);
    for (let i = 0; i < 4; i++) {
      const code = await inviteFrom("alice");
      const id = `n${i}`;
      await addUser(id, `n${i}@example.net`, { verified: false });
      await holdInviteOnSignup(id, code);
      await verify(id);
      const r = await acceptPendingInvite(id);
      expect(r).toMatchObject({ ok: true, inviteeDays: 7, inviterDays: i < 3 ? 7 : 0 });
    }
    expect(await daysLeft("alice")).toBe(21);
  });
});

describe("email helpers", () => {
  it("canonicalises aliases and spots throwaway domains", () => {
    expect(canonicalEmail("A.Lice+x@GoogleMail.com")).toBe("alice@gmail.com");
    expect(canonicalEmail("bob+tag@example.com")).toBe("bob@example.com");
    expect(isDisposableEmail("z@mailinator.com")).toBe(true);
    expect(isDisposableEmail("z@sub.yopmail.com")).toBe(true);
    expect(isDisposableEmail("z@example.com")).toBe(false);
  });
});
