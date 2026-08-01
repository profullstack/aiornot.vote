import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("./env", () => ({
  env: {
    coinpayConfigured: true,
    coinpay: {
      baseUrl: "https://api.coinpay.test",
      apiKey: "test_api_key",
      businessId: "test_biz",
    },
  },
}));

import {
  createCoinpayPayment,
  getCoinpayPayment,
  getCoinpayPaymentDetailed,
  isPaymentPaid,
} from "./coinpay";

describe("isPaymentPaid", () => {
  it("returns true for confirmed, forwarded, forwarding, completed, or paid", () => {
    expect(isPaymentPaid("confirmed")).toBe(true);
    expect(isPaymentPaid("forwarded")).toBe(true);
    expect(isPaymentPaid("forwarding")).toBe(true);
    expect(isPaymentPaid("completed")).toBe(true);
    expect(isPaymentPaid("paid")).toBe(true);
  });

  it("returns false for pending or undefined", () => {
    expect(isPaymentPaid("pending")).toBe(false);
    expect(isPaymentPaid("failed")).toBe(false);
    expect(isPaymentPaid(undefined)).toBe(false);
  });
});

describe("getCoinpayPaymentDetailed error handling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error result when fetch fails with non-2xx status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 502,
    } as Response);

    const res = await getCoinpayPaymentDetailed("pay_123");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("HTTP 502");
    }
  });

  it("returns error result when fetch throws an exception", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

    const res = await getCoinpayPaymentDetailed("pay_123");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Network timeout");
    }
  });

  it("returns ok result with payment data when fetch succeeds", async () => {
    const mockPayment = {
      id: "pay_123",
      amount: 10,
      currency: "USD",
      blockchain: "solana",
      status: "confirmed",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, payment: mockPayment }),
    } as Response);

    const res = await getCoinpayPaymentDetailed("pay_123");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payment).toEqual(mockPayment);
    }
  });

  it("getCoinpayPayment backward compatibility returns null on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const res = await getCoinpayPayment("pay_123");
    expect(res).toBeNull();
  });
});
