import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted above top-level consts, so the mock fn must
// be created via vi.hoisted() to avoid a temporal-dead-zone ReferenceError.
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("./db", () => ({
  sqlClient: { execute },
}));

import { rateLimit } from "./rate-limit";

/** Simulate the DB upsert: insert or increment like the real SQL. */
function mockDb() {
  const store = new Map<string, { count: number; resetAt: number }>();
  execute.mockImplementation(
    async ({ sql, args }: { sql: string; args: unknown[] }) => {
      const key = String(args[0]);
      if (sql.includes("INSERT INTO rate_limits")) {
        const resetAt = Number(args[1]);
        const now = Number(args[2]);
        const nextResetAt = Number(args[4]);
        const existing = store.get(key);
        if (!existing || existing.resetAt <= now) {
          store.set(key, { count: 1, resetAt });
        } else {
          store.set(key, { count: existing.count + 1, resetAt: existing.resetAt });
        }
        return { rows: [] };
      }
      if (sql.includes("SELECT bucket_count")) {
        const row = store.get(key);
        return { rows: row ? [{ bucket_count: row.count, reset_at: row.resetAt }] : [] };
      }
      if (sql.includes("DELETE FROM rate_limits")) {
        const before = Number(args[0]);
        for (const [k, v] of store) if (v.resetAt < before) store.delete(k);
        return { rows: [] };
      }
      return { rows: [] };
    },
  );
  return store;
}

describe("rateLimit (DB-backed)", () => {
  beforeEach(() => {
    execute.mockReset();
    mockDb();
  });

  it("allows requests under the limit and tracks remaining", async () => {
    const r1 = await rateLimit("k", 3, 60_000);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
    const r2 = await rateLimit("k", 3, 60_000);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it("rejects once the limit is exceeded", async () => {
    await rateLimit("k", 2, 60_000);
    await rateLimit("k", 2, 60_000);
    const r3 = await rateLimit("k", 2, 60_000);
    expect(r3.ok).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("resets the window after it expires", async () => {
    await rateLimit("k", 1, 10);
    // advance simulated time by re-mocking with an expired bucket
    const store = mockDb();
    const now = Date.now();
    store.set("k", { count: 5, resetAt: now - 1 });
    const r = await rateLimit("k", 1, 60_000);
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(0);
  });
});
