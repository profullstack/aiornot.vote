import { describe, expect, it } from "vitest";
import { normalizeSponsorAmountUsd } from "./sponsor-amount";

describe("normalizeSponsorAmountUsd", () => {
  it("normalizes valid sponsor amounts to cents", () => {
    expect(normalizeSponsorAmountUsd("5.129")).toEqual({ ok: true, amount: 5.13 });
  });

  it("rejects amounts below the sponsorship minimum", () => {
    expect(normalizeSponsorAmountUsd("4.99")).toEqual({
      ok: false,
      error: "Minimum sponsorship is $5.",
    });
  });

  it("rejects non-finite amounts before creating a payment", () => {
    expect(normalizeSponsorAmountUsd("Infinity")).toEqual({
      ok: false,
      error: "Enter a valid sponsorship amount.",
    });
    expect(normalizeSponsorAmountUsd(Number.NaN)).toEqual({
      ok: false,
      error: "Enter a valid sponsorship amount.",
    });
  });

  it("rejects non-decimal amount strings before creating a payment", () => {
    expect(normalizeSponsorAmountUsd("1e2")).toEqual({
      ok: false,
      error: "Enter a valid sponsorship amount.",
    });
    expect(normalizeSponsorAmountUsd("0x10")).toEqual({
      ok: false,
      error: "Enter a valid sponsorship amount.",
    });
  });
});
