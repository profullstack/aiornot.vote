import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { passFromUserinfo } from "@profullstack/coinpay-onboard/pass";
import { applyCoinpayPass, libraryUntilWithPass } from "./coinpay-pass";

const NOW = Date.parse("2026-11-07T00:00:00Z");
const END = "2026-12-07T00:00:00.000Z";
const claim = (pass: unknown) => passFromUserinfo({ pass }, new Date(NOW));

describe("libraryUntilWithPass", () => {
  it("moves the library pass to the pass end only when that is later", () => {
    const pass = claim({ active: true, expires_at: END });
    expect(libraryUntilWithPass(null, pass, NOW)).toBe(END);
    expect(libraryUntilWithPass("2026-11-10T00:00:00.000Z", pass, NOW)).toBe(END);
    expect(libraryUntilWithPass("2027-01-01T00:00:00.000Z", pass, NOW)).toBeNull();
    expect(libraryUntilWithPass(END, pass, NOW)).toBeNull();
  });

  it("ignores an inactive, expired or malformed pass", () => {
    expect(libraryUntilWithPass(null, claim({ active: false, expires_at: END }), NOW)).toBeNull();
    expect(libraryUntilWithPass(null, claim({ active: true, expires_at: "2026-01-01T00:00:00Z" }), NOW)).toBeNull();
    expect(libraryUntilWithPass(null, claim({ active: true, expires_at: "soon" }), NOW)).toBeNull();
    expect(libraryUntilWithPass(null, undefined, NOW)).toBeNull();
  });
});

describe("applyCoinpayPass", () => {
  it("sets library_pass_until once per pass and keeps a longer paid pass", async () => {
    const db = createClient({ url: ":memory:" });
    await db.execute("CREATE TABLE users (id TEXT PRIMARY KEY, library_pass_until TEXT, updated_at TEXT)");
    await db.execute("INSERT INTO users (id) VALUES ('u1'), ('u2')");
    await db.execute("UPDATE users SET library_pass_until = '2027-02-01T00:00:00.000Z' WHERE id = 'u2'");
    const pass = claim({ active: true, expires_at: END });

    expect(await applyCoinpayPass(db, "u1", pass, NOW)).toBe(END);
    expect(await applyCoinpayPass(db, "u1", pass, NOW)).toBeNull();
    expect(await applyCoinpayPass(db, "u2", pass, NOW)).toBeNull();
    expect(await applyCoinpayPass(db, "nobody", pass, NOW)).toBeNull();
    const rows = await db.execute("SELECT id, library_pass_until FROM users ORDER BY id");
    expect(rows.rows.map((r) => [r.id, r.library_pass_until])).toEqual([
      ["u1", END],
      ["u2", "2027-02-01T00:00:00.000Z"],
    ]);
  });
});
