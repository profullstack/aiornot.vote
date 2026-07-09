import { describe, expect, it } from "vitest";
import {
  coinpayBlockchainLabel,
  normalizeCoinpayBlockchain,
} from "./coinpay-blockchains";

describe("normalizeCoinpayBlockchain", () => {
  it("normalizes supported CoinPay blockchain values", () => {
    expect(normalizeCoinpayBlockchain(" sol ")).toBe("SOL");
    expect(normalizeCoinpayBlockchain("usdc_eth")).toBe("USDC_ETH");
  });

  it("defaults missing values to SOL", () => {
    expect(normalizeCoinpayBlockchain(undefined)).toBe("SOL");
    expect(normalizeCoinpayBlockchain("")).toBe("SOL");
  });

  it("rejects unsupported values", () => {
    expect(normalizeCoinpayBlockchain("BASE")).toBeNull();
    expect(normalizeCoinpayBlockchain("javascript:alert(1)")).toBeNull();
  });
});

describe("coinpayBlockchainLabel", () => {
  it("formats labels for display", () => {
    expect(coinpayBlockchainLabel("USDC_POL")).toBe("USDC POL");
  });
});
