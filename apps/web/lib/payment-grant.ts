import type { Transaction } from "@libsql/client";
import { grantForPayment, type GrantResult } from "./entitlements";

type GrantPaymentArgs = {
  tx: Transaction;
  paymentId: string;
  userId: string;
  purpose: string;
};

/**
 * Claim a paid payment and deliver its entitlement atomically.
 *
 * The status claim and entitlement writes share one transaction. A failed
 * entitlement write rolls back the claim, leaving the payment retryable.
 */
export async function grantPaymentInTransaction({
  tx,
  paymentId,
  userId,
  purpose,
}: GrantPaymentArgs): Promise<GrantResult | null> {
  try {
    // A webhook may have left the row pending while CoinPay is already paid.
    await tx.execute({
      sql: "UPDATE payments SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
      args: [paymentId],
    });
    const claim = await tx.execute({
      sql: "UPDATE payments SET status = 'granted', granted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'confirmed'",
      args: [paymentId],
    });
    if (claim.rowsAffected === 0) {
      await tx.rollback();
      return null;
    }

    const grant = await grantForPayment({ id: paymentId, userId, purpose }, tx);
    await tx.commit();
    return grant;
  } catch (error) {
    try {
      await tx.rollback();
    } catch (rollbackError) {
      console.error("Payment grant rollback failed", { paymentId, rollbackError });
    }
    throw error;
  }
}
