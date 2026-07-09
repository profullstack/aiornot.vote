import { describe, expect, it } from "vitest";
import { normalizePage } from "./pagination";

describe("normalizePage", () => {
  it("accepts positive numeric page values", () => {
    expect(normalizePage("3")).toBe(3);
    expect(normalizePage(2)).toBe(2);
    expect(normalizePage("4.9")).toBe(4);
  });

  it("falls back for non-finite or invalid page values", () => {
    expect(normalizePage(undefined)).toBe(1);
    expect(normalizePage("")).toBe(1);
    expect(normalizePage("Infinity")).toBe(1);
    expect(normalizePage(Number.POSITIVE_INFINITY)).toBe(1);
    expect(normalizePage("not-a-page")).toBe(1);
  });

  it("falls back for zero and negative page values", () => {
    expect(normalizePage("0")).toBe(1);
    expect(normalizePage("-2")).toBe(1);
  });
});
