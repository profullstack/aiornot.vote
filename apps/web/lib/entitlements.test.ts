import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const execute = vi.fn();
vi.mock("./db", () => ({
  sqlClient: { execute },
}));
vi.mock("@aiornot/db", () => ({
  newId: () => "key_test",
}));

import { normalizeApiKeyLabel, recordPromoRedemption } from "./entitlements";

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
});
