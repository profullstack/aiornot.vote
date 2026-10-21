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
  checkoutSessionBody,
  createCoinpayCheckoutSession,
  getCoinpayReferenceStatus,
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

describe("checkout sessions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("the session body carries email, account, property and our metadata", () => {
    const body = checkoutSessionBody({
      amountUsd: 5,
      description: "AIorNot.vote lifetime membership",
      customerEmail: "a@example.com",
      accountId: "user-1",
      metadata: { payment_ref: "pay_1", purpose: "lifetime_membership" },
      successUrl: "https://aiornot.vote/checkout/pay_1?session={CHECKOUT_SESSION_ID}",
      cancelUrl: "https://aiornot.vote/pricing",
    });
    expect(body).toMatchObject({
      amount: 5,
      currency: "USD",
      customer_email: "a@example.com",
      account_id: "user-1",
      property: "aiornot.vote",
      metadata: { payment_ref: "pay_1" },
      expires_in_minutes: 60,
    });
    expect(body).not.toHaveProperty("blockchain");
  });

  it("POSTs /checkout/sessions with the business key and returns id + url", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, id: "cs_1", url: "https://api.coinpay.test/checkout/cs_1" }), { status: 201 }),
    );
    const out = await createCoinpayCheckoutSession({
      amountUsd: 5, description: "d", customerEmail: "a@example.com", accountId: "user-1",
      metadata: {}, successUrl: "https://aiornot.vote/x", cancelUrl: "https://aiornot.vote/y",
    });
    expect(out).toEqual({ ok: true, session: { id: "cs_1", url: "https://api.coinpay.test/checkout/cs_1", expires_at: undefined } });
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.coinpay.test/checkout/sessions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test_api_key");
    expect(JSON.parse(String(init.body))).toMatchObject({ customer_email: "a@example.com", account_id: "user-1", property: "aiornot.vote" });
  });

  it("refuses a checkout url on another origin", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "cs_1", url: "https://evil.example/checkout/cs_1" }), { status: 201 }),
    );
    const out = await createCoinpayCheckoutSession({
      amountUsd: 5, description: "d", customerEmail: "a@example.com", accountId: "u", metadata: {}, successUrl: "s", cancelUrl: "c",
    });
    expect(out.ok).toBe(false);
  });

  it("a session reference is paid only when the session is paid", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { status: "open" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: { status: "paid" } }), { status: 200 }));
    expect(await getCoinpayReferenceStatus("cs_1")).toEqual({ paid: false, status: "pending" });
    expect(await getCoinpayReferenceStatus("cs_1")).toEqual({ paid: true, status: "paid" });
  });
});
