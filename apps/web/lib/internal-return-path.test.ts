import { describe, expect, it } from "vitest";
import { internalReturnPath } from "./internal-return-path";

describe("internalReturnPath", () => {
  it("preserves internal paths with query strings and fragments", () => {
    expect(internalReturnPath("/refer")).toBe("/refer");
    expect(internalReturnPath("/search?q=human#results")).toBe("/search?q=human#results");
  });

  it("falls back for missing or external destinations", () => {
    expect(internalReturnPath(null)).toBe("/account");
    expect(internalReturnPath("https://example.com")).toBe("/account");
    expect(internalReturnPath("//example.com/path")).toBe("/account");
    expect(internalReturnPath("/\\example.com/path")).toBe("/account");
  });
});
