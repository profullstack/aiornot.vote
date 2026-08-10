import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getCurrentUser: vi.fn(),
  getCoinpayPayment: vi.fn(),
  isPaymentPaid: vi.fn(),
  grantForPayment: vi.fn(),
  recordPromoRedemption: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  sqlClient: { execute: mocks.execute },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/coinpay", () => ({
  getCoinpayPayment: mocks.getCoinpayPayment,
  isPaymentPaid: mocks.isPaymentPaid,
}));

vi.mock("@/lib/entitlements", () => ({
  grantForPayment: mocks.grantForPayment,
  recordPromoRedemption: mocks.recordPromoRedemption,
}));

import { GET } from "../app/api/payments/status/route";

describe("GET /api/payments/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
  });

  it("restores a confirmed payment when granting its entitlement fails", async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "payment-1",
            user_id: "user-1",
            purpose: "api_access",
            status: "confirmed",
            coinpay_payment_id: "coinpay-1",
            promo_code: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowsAffected: 1 })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    mocks.grantForPayment.mockRejectedValue(new Error("key insert failed"));

    const response = await GET(
      new Request("https://aiornot.vote/api/payments/status?id=payment-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      error: "Could not grant purchase. Please retry.",
    });
    expect(mocks.execute).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        sql: expect.stringContaining("status = 'confirmed', granted_at = NULL"),
        args: ["payment-1"],
      }),
    );
    expect(mocks.recordPromoRedemption).not.toHaveBeenCalled();
  });

  it("returns the one-time API key when granting succeeds", async () => {
    mocks.execute
      .mockResolvedValueOnce({
        rows: [
          {
            id: "payment-1",
            user_id: "user-1",
            purpose: "api_access",
            status: "confirmed",
            coinpay_payment_id: "coinpay-1",
            promo_code: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    mocks.grantForPayment.mockResolvedValue({
      apiKeyPlaintext: "aion_live_secret",
    });

    const response = await GET(
      new Request("https://aiornot.vote/api/payments/status?id=payment-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      status: "granted",
      purpose: "api_access",
      apiKey: "aion_live_secret",
    });
    expect(mocks.execute).toHaveBeenCalledTimes(2);
  });
});
