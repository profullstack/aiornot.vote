import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
// vi.mock factories are hoisted above top-level consts — create the mock fn
// via vi.hoisted() to avoid a temporal-dead-zone ReferenceError.
const { execute, transaction, txExecute, commit, rollback, close } = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  txExecute: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./db", () => ({
  sqlClient: { execute, transaction },
}));
vi.mock("@aiornot/db", () => ({
  newId: () => "key_test",
}));

import { grantFreePromo, normalizeApiKeyLabel, recordPromoRedemption } from "./entitlements";

describe("normalizeApiKeyLabel", () => {
  it("trims and collapses labels before storing them", () => {
    expect(normalizeApiKeyLabel("  Production   API   key  ")).toBe("Production API key");
  });

  it("stores blank labels as null", () => {
    expect(normalizeApiKeyLabel("   ")).toBeNull();
    expect(normalizeApiKeyLabel()).toBeNull();
  });

  it("limits labels to the database display length", () => {
    expect(normalizeApiKeyLabel("a".repeat(80))).toHaveLength(60);
  });
});

describe("recordPromoRedemption (atomic duplicate guard, #92)", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("records a new redemption and bumps uses", async () => {
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 }); // INSERT OR IGNORE
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 }); // UPDATE uses
    const ok = await recordPromoRedemption("summer25", "user_1");
    expect(ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(String(execute.mock.calls[0][0].sql)).toContain("INSERT OR IGNORE");
    expect(String(execute.mock.calls[1][0].sql)).toContain("uses < max_uses");
  });

  it("normalizes the code to uppercase", async () => {
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 });
    await recordPromoRedemption("  summer25 ", "user_1");
    expect(execute.mock.calls[0][0].args).toEqual(["SUMMER25", "user_1"]);
  });

  it("returns false and skips the increment when the row already exists", async () => {
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 }); // duplicate — INSERT OR IGNORE no-op
    const ok = await recordPromoRedemption("SUMMER25", "user_1");
    expect(ok).toBe(false);
    expect(execute).toHaveBeenCalledTimes(1); // no UPDATE issued
  });

  it("returns false for a blank code", async () => {
    const ok = await recordPromoRedemption("   ", "user_1");
    expect(ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  // The grant (and its one-time API key) is already issued by the time we get
  // here, so a DB blip must not escape and 500 the caller's response.
  it("swallows a failing INSERT and returns false", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockRejectedValueOnce(new Error("db unreachable"));
    await expect(recordPromoRedemption("SUMMER25", "user_1")).resolves.toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("swallows a failing uses increment but still reports the recorded row", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    execute.mockResolvedValueOnce({ rows: [], rowsAffected: 1 }); // INSERT OR IGNORE landed
    execute.mockRejectedValueOnce(new Error("db unreachable")); // UPDATE uses blew up
    await expect(recordPromoRedemption("SUMMER25", "user_1")).resolves.toBe(true);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("grantFreePromo", () => {
  beforeEach(() => {
    transaction.mockReset();
    txExecute.mockReset();
    commit.mockReset();
    rollback.mockReset();
    close.mockReset();
    transaction.mockResolvedValue({ execute: txExecute, commit, rollback, close });
  });

  it("claims the redemption and grants membership in one transaction", async () => {
    txExecute
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [], rowsAffected: 1 });

    const result = await grantFreePromo({
      paymentId: "pay_1",
      userId: "user_1",
      purpose: "lifetime_membership",
      code: " free100 ",
    });

    expect(result).toEqual({ ok: true, grant: {} });
    expect(transaction).toHaveBeenCalledWith("write");
    expect(String(txExecute.mock.calls[0][0].sql)).toContain("INSERT OR IGNORE INTO promo_redemptions");
    expect(txExecute.mock.calls[0][0].args).toEqual(["FREE100", "user_1"]);
    expect(String(txExecute.mock.calls[1][0].sql)).toContain("percent_off >= 100");
    expect(String(txExecute.mock.calls[2][0].sql)).toContain("UPDATE users SET is_lifetime_member = 1");
    expect(String(txExecute.mock.calls[3][0].sql)).toContain("INSERT INTO payments");
    expect(commit).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not grant when another request already claimed the code", async () => {
    txExecute.mockResolvedValueOnce({ rows: [], rowsAffected: 0 });

    const result = await grantFreePromo({
      paymentId: "pay_2",
      userId: "user_1",
      purpose: "api_access",
      code: "FREE100",
    });

    expect(result).toEqual({ ok: false, error: "That code is no longer available." });
    expect(txExecute).toHaveBeenCalledOnce();
    expect(rollback).toHaveBeenCalledOnce();
    expect(commit).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});
