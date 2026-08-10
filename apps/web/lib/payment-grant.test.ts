import { beforeEach, describe, expect, it, vi } from "vitest";

const { grantForPayment } = vi.hoisted(() => ({ grantForPayment: vi.fn() }));
vi.mock("./entitlements", () => ({ grantForPayment }));

import { grantPaymentInTransaction } from "./payment-grant";

function makeTx() {
  return {
    execute: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
  };
}

describe("grantPaymentInTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back the claim when entitlement delivery fails", async () => {
    const tx = makeTx();
    tx.execute.mockResolvedValueOnce({ rowsAffected: 1 });
    tx.execute.mockResolvedValueOnce({ rowsAffected: 1 });
    grantForPayment.mockRejectedValueOnce(new Error("api key insert failed"));

    await expect(
      grantPaymentInTransaction({ tx: tx as never, paymentId: "pay_1", userId: "user_1", purpose: "api_access" }),
    ).rejects.toThrow("api key insert failed");
    expect(tx.commit).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalledOnce();
  });

  it("commits only after the entitlement is delivered", async () => {
    const tx = makeTx();
    tx.execute.mockResolvedValueOnce({ rowsAffected: 1 });
    tx.execute.mockResolvedValueOnce({ rowsAffected: 1 });
    grantForPayment.mockResolvedValueOnce({ apiKeyPlaintext: "aion_live_test" });

    const result = await grantPaymentInTransaction({
      tx: tx as never,
      paymentId: "pay_1",
      userId: "user_1",
      purpose: "api_access",
    });

    expect(result).toEqual({ apiKeyPlaintext: "aion_live_test" });
    expect(grantForPayment).toHaveBeenCalledWith(
      { id: "pay_1", userId: "user_1", purpose: "api_access" },
      tx,
    );
    expect(tx.commit).toHaveBeenCalledOnce();
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it("does not grant when another poll already claimed the payment", async () => {
    const tx = makeTx();
    tx.execute.mockResolvedValueOnce({ rowsAffected: 1 });
    tx.execute.mockResolvedValueOnce({ rowsAffected: 0 });

    const result = await grantPaymentInTransaction({
      tx: tx as never,
      paymentId: "pay_1",
      userId: "user_1",
      purpose: "api_access",
    });

    expect(result).toBeNull();
    expect(grantForPayment).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalledOnce();
  });
});
