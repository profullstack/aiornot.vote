import { describe, expect, it } from "vitest";
import { normalizePromoMaxUses, normalizePromoPercentOff } from "./promo-form";

describe("promo form normalization", () => {
  it("clamps decimal percent discounts to the allowed range", () => {
    expect(normalizePromoPercentOff("25")).toBe(25);
    expect(normalizePromoPercentOff("0")).toBe(1);
    expect(normalizePromoPercentOff("150")).toBe(100);
  });

  it("falls back for invalid percent discounts", () => {
    expect(normalizePromoPercentOff("")).toBe(100);
    expect(normalizePromoPercentOff("1e2")).toBe(100);
    expect(normalizePromoPercentOff("0x10")).toBe(100);
    expect(normalizePromoPercentOff("NaN")).toBe(100);
  });

  it("normalizes optional max uses", () => {
    expect(normalizePromoMaxUses("")).toBeNull();
    expect(normalizePromoMaxUses("5")).toBe(5);
    expect(normalizePromoMaxUses("0")).toBe(1);
  });

  it("ignores invalid max uses instead of returning NaN", () => {
    expect(normalizePromoMaxUses("1e2")).toBeNull();
    expect(normalizePromoMaxUses("0x10")).toBeNull();
    expect(normalizePromoMaxUses("NaN")).toBeNull();
  });
});
