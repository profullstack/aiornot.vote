import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const SECRET = "whsecret_aiornotWebhookTestSecret";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  transaction: vi.fn(),
  txClose: vi.fn(),
  sendEmail: vi.fn(),
  grantPaymentInTransaction: vi.fn(),
  recordPromoRedemption: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { coinpay: { webhookSecret: "whsecret_aiornotWebhookTestSecret" }, adminEmails: ["admin@example.com"] },
}));
vi.mock("./env", () => ({
  env: { coinpay: { webhookSecret: "whsecret_aiornotWebhookTestSecret" }, adminEmails: ["admin@example.com"] },
}));
vi.mock("./db", () => ({ sqlClient: { execute: mocks.execute, transaction: mocks.transaction } }));
vi.mock("@/lib/db", () => ({ sqlClient: { execute: mocks.execute, transaction: mocks.transaction } }));
vi.mock("./email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("./payment-grant", () => ({ grantPaymentInTransaction: mocks.grantPaymentInTransaction }));
vi.mock("./entitlements", () => ({ recordPromoRedemption: mocks.recordPromoRedemption }));
vi.mock("./prizes", () => ({ currentWeekStart: () => "2026-10-19" }));

import { POST } from "../app/api/payments/coinpay/webhook/route";

/** Exactly what coinpayportal src/lib/webhooks/service.ts sends. */
function coinpayEvent(paymentId: string, type: string, status: string, metadata: Record<string, unknown>) {
  const ts = Math.floor(Date.now() / 1000);
  return {
    id: `evt_${paymentId}_${ts}`,
    type,
    data: {
      payment_id: paymentId,
      status,
      amount: 25,
      amount_crypto: "25.000000",
      amount_usd: 25,
      currency: "USDC_POL",
      confirmations: 12,
      payment_address: "0xabc",
      tx_hash: "0xdef",
      metadata,
    },
    created_at: new Date().toISOString(),
    business_id: "biz-1",
  };
}

function signed(body: unknown, secret = SECRET) {
  const raw = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return new Request("https://aiornot.vote/api/payments/coinpay/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "x-coinpay-signature": `t=${t},v1=${v1}` },
    body: raw,
  });
}

describe("POST /api/payments/coinpay/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.transaction.mockResolvedValue({ close: mocks.txClose });
  });

  it("rejects a body signed with the wrong secret", async () => {
    const res = await POST(signed(coinpayEvent("cp-1", "payment.confirmed", "confirmed", {}), "whsecret_wrong"));
    expect(res.status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("activates a paid prize sponsorship once, matched on sponsorship and CoinPay ids", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [{ sponsor_name: "Acme", prize_label: "$50", amount_usd: 25 }] });
    const res = await POST(
      signed(coinpayEvent("cp-spo", "payment.confirmed", "confirmed", {
        purpose: "prize_sponsorship",
        sponsorship_id: "spo_1",
        property: "aiornot.vote",
        account_id: "user-1",
      })),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ handled: true, kind: "sponsorship", sponsorshipId: "spo_1", activated: true });
    expect(mocks.execute.mock.calls[0][0].sql).toMatch(/UPDATE prize_sponsorships SET status = 'active'/);
    expect(mocks.execute.mock.calls[0][0].args).toEqual(["spo_1", "cp-spo"]);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("is a no-op on a replayed sponsorship webhook", async () => {
    mocks.execute.mockResolvedValueOnce({ rowsAffected: 0 });
    const res = await POST(
      signed(coinpayEvent("cp-spo", "payment.forwarded", "forwarded", { purpose: "prize_sponsorship", sponsorship_id: "spo_1" })),
    );
    expect(await res.json()).toMatchObject({ handled: true, activated: false });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("grants a lifetime membership to the payment's account", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: "pay_1", user_id: "user-1", purpose: "lifetime_membership", status: "pending", promo_code: null }] })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    mocks.grantPaymentInTransaction.mockResolvedValue({});
    const res = await POST(
      signed(coinpayEvent("cp-pay", "payment.confirmed", "confirmed", { purpose: "lifetime_membership", payment_ref: "pay_1", account_id: "user-1" })),
    );
    expect(await res.json()).toMatchObject({ handled: true, kind: "payment", paymentRef: "pay_1", granted: true });
    // Looked up by data.payment_id, never the evt_ id.
    expect(mocks.execute.mock.calls[0][0].args).toEqual(["cp-pay"]);
    expect(mocks.grantPaymentInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: "pay_1", userId: "user-1", purpose: "lifetime_membership" }),
    );
    expect(mocks.txClose).toHaveBeenCalled();
  });

  it("only confirms API access so the key is revealed on the buyer's status poll", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: "pay_2", user_id: "user-1", purpose: "api_access", status: "pending", promo_code: null }] })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    const res = await POST(signed(coinpayEvent("cp-api", "payment.confirmed", "confirmed", { purpose: "api_access", payment_ref: "pay_2" })));
    expect(await res.json()).toMatchObject({ handled: true, granted: false });
    expect(mocks.grantPaymentInTransaction).not.toHaveBeenCalled();
  });

  it("refuses a payment whose metadata names another account", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ id: "pay_3", user_id: "user-1", purpose: "play_pass", status: "pending" }] });
    const res = await POST(signed(coinpayEvent("cp-x", "payment.confirmed", "confirmed", { account_id: "user-2" })));
    expect(await res.json()).toMatchObject({ handled: false, reason: "account mismatch" });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("answers 200 handled:false for an unknown payment", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [] });
    const res = await POST(signed(coinpayEvent("cp-missing", "payment.confirmed", "confirmed", {})));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, handled: false, reason: "unknown payment" });
  });

  it("ignores an expired payment", async () => {
    const res = await POST(signed(coinpayEvent("cp-exp", "payment.expired", "expired", { purpose: "prize_sponsorship", sponsorship_id: "spo_9" })));
    expect(await res.json()).toMatchObject({ handled: false });
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  /** A session payment: CoinPay adds the session fields to data. */
  function sessionEvent(type: string, status: string, metadata: Record<string, unknown>, account = "user-1") {
    const e = coinpayEvent("cp-sess-pay", type, status, metadata);
    return {
      ...e,
      data: { ...e.data, checkout_session_id: "cs_test123", account_id: account, customer_email: "a@example.com", property: "aiornot.vote" },
    };
  }

  it("settles a checkout-session payment by checkout_session_id, not the payment id", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: "pay_s1", user_id: "user-1", purpose: "lifetime_membership", status: "pending", promo_code: null }] })
      .mockResolvedValueOnce({ rowsAffected: 1 });
    mocks.grantPaymentInTransaction.mockResolvedValue({});
    const res = await POST(signed(sessionEvent("payment.confirmed", "confirmed", { purpose: "lifetime_membership", payment_ref: "pay_s1" })));
    expect(await res.json()).toMatchObject({ handled: true, kind: "payment", paymentRef: "pay_s1", granted: true });
    expect(mocks.execute.mock.calls[0][0].args).toEqual(["cs_test123"]);
  });

  it("a replayed or forwarded session event does not grant twice", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rows: [{ id: "pay_s1", user_id: "user-1", purpose: "lifetime_membership", status: "granted", promo_code: "HALF" }] })
      .mockResolvedValueOnce({ rowsAffected: 0 });
    mocks.grantPaymentInTransaction.mockResolvedValue(null);
    const res = await POST(signed(sessionEvent("payment.forwarded", "forwarded", { purpose: "lifetime_membership", payment_ref: "pay_s1" })));
    expect(await res.json()).toMatchObject({ handled: true, granted: false });
    expect(mocks.recordPromoRedemption).not.toHaveBeenCalled();
  });

  it("refuses a session event whose account_id is not the buyer", async () => {
    mocks.execute.mockResolvedValueOnce({ rows: [{ id: "pay_s1", user_id: "user-1", purpose: "play_pass", status: "pending" }] });
    const res = await POST(signed(sessionEvent("payment.confirmed", "confirmed", { purpose: "play_pass" }, "user-2")));
    expect(await res.json()).toMatchObject({ handled: false, reason: "account mismatch" });
  });

  it("activates a session sponsorship matched on the session id", async () => {
    mocks.execute
      .mockResolvedValueOnce({ rowsAffected: 1 })
      .mockResolvedValueOnce({ rows: [{ sponsor_name: "Acme", prize_label: "$50", amount_usd: 25 }] });
    const res = await POST(signed(sessionEvent("payment.confirmed", "confirmed", { purpose: "prize_sponsorship", sponsorship_id: "spo_s" })));
    expect(await res.json()).toMatchObject({ handled: true, kind: "sponsorship", sponsorshipId: "spo_s", activated: true });
    expect(mocks.execute.mock.calls[0][0].args).toEqual(["spo_s", "cs_test123"]);
  });

  it("a pending session event settles nothing", async () => {
    const res = await POST(signed(sessionEvent("payment.pending", "pending", { purpose: "lifetime_membership" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ handled: false });
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
