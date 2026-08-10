import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  getCurrentUser: vi.fn(),
  getCoinpayPayment: vi.fn(),
  isPaymentPaid: vi.fn(),
  grantPaymentInTransaction: vi.fn(),
  recordPromoRedemption: vi.fn(),
  txClose: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  sqlClient: { execute: mocks.execute, transaction: mocks.transaction },
}));

vi.mock("@/lib/session", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/coinpay", () => ({
  getCoinpayPayment: mocks.getCoinpayPayment,
  isPaymentPaid: mocks.isPaymentPaid,
}));

vi.mock("@/lib/entitlements", () => ({
  recordPromoRedemption: mocks.recordPromoRedemption,
}));

vi.mock("@/lib/payment-grant", () => ({
  grantPaymentInTransaction: mocks.grantPaymentInTransaction,
}));

import { GET } from "../app/api/payments/status/route";

const confirmedPayment = {
  id: "payment-1",
  user_id: "user-1",
  purpose: "api_access",
  status: "confirmed",
  coinpay_payment_id: "coinpay-1",
  promo_code: null,
};

describe("GET /api/payments/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.transaction.mockResolvedValue({ close: mocks.txClose });
  });

  it("leaves the payment retryable when granting its entitlement fails", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [confirmedPayment] });
    mocks.grantPaymentInTransaction.mockRejectedValue(new Error("key insert failed"));

    const response = await GET(
      new Request("https://aiornot.vote/api/payments/status?id=payment-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      ok: false,
      status: "confirmed",
      error:
        "Payment confirmed, but entitlement delivery failed. Retry the status check.",
    });
    // The transaction owns the rollback, so no compensating UPDATE is issued.
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.txClose).toHaveBeenCalled();
    expect(mocks.recordPromoRedemption).not.toHaveBeenCalled();
  });

  it("returns the one-time API key when granting succeeds", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [confirmedPayment] });
    mocks.grantPaymentInTransaction.mockResolvedValue({
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
    expect(mocks.grantPaymentInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "payment-1",
        userId: "user-1",
        purpose: "api_access",
      }),
    );
    expect(mocks.txClose).toHaveBeenCalled();
  });

  it("reports granted without an API key when another poll already claimed it", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [confirmedPayment] });
    mocks.grantPaymentInTransaction.mockResolvedValue(null);

    const response = await GET(
      new Request("https://aiornot.vote/api/payments/status?id=payment-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "granted", purpose: "api_access" });
    expect(mocks.recordPromoRedemption).not.toHaveBeenCalled();
  });

  it("records the redemption for a discounted promo payment", async () => {
    mocks.execute.mockResolvedValueOnce({
      rows: [{ ...confirmedPayment, promo_code: "LAUNCH50" }],
    });
    mocks.grantPaymentInTransaction.mockResolvedValue({
      apiKeyPlaintext: "aion_live_secret",
    });

    const response = await GET(
      new Request("https://aiornot.vote/api/payments/status?id=payment-1"),
    );

    expect(response.status).toBe(200);
    expect(mocks.recordPromoRedemption).toHaveBeenCalledWith("LAUNCH50", "user-1");
  });
});
