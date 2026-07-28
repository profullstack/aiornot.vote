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
