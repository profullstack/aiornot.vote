import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({
  sqlClient: {
    execute: vi.fn(),
  },
}));
vi.mock("@aiornot/db", () => ({
  newId: () => "key_test",
}));

import { normalizeApiKeyLabel } from "./entitlements";

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

import { recordPromoRedemption } from "./entitlements";
import { sqlClient } from "./db";
import { beforeEach } from "vitest";

describe("recordPromoRedemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("increments uses counter on successful redemption insert", async () => {
    vi.mocked(sqlClient.execute)
      .mockResolvedValueOnce({ rowsAffected: 1, rows: [] } as any)
      .mockResolvedValueOnce({ rowsAffected: 1, rows: [] } as any);

    const success = await recordPromoRedemption("SAVE20", "user_123");
    expect(success).toBe(true);
    expect(sqlClient.execute).toHaveBeenCalledWith({
      sql: "INSERT INTO promo_redemptions (code, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
      args: ["SAVE20", "user_123"],
    });
    expect(sqlClient.execute).toHaveBeenCalledWith({
      sql: "UPDATE promo_codes SET uses = uses + 1 WHERE code = ?",
      args: ["SAVE20"],
    });
  });

  it("does not increment uses counter when duplicate insert is skipped on conflict", async () => {
    vi.mocked(sqlClient.execute).mockResolvedValueOnce({ rowsAffected: 0, rows: [] } as any);

    const success = await recordPromoRedemption("SAVE20", "user_123");
    expect(success).toBe(false);
    expect(sqlClient.execute).toHaveBeenCalledWith({
      sql: "INSERT INTO promo_redemptions (code, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
      args: ["SAVE20", "user_123"],
    });
    expect(sqlClient.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("UPDATE promo_codes") })
    );
  });
});
