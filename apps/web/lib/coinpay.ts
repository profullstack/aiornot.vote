import "server-only";
import { env } from "./env";

export type CoinpayPayment = {
  id: string;
  amount: number;
  currency: string;
  blockchain: string;
  crypto_amount?: string;
  payment_address?: string;
  qr_code?: string;
  status: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
};

/** Create a hosted crypto payment. Returns the address/QR to show the customer. */
export async function createCoinpayPayment(args: {
  amountUsd: number;
  blockchain: string;
  description: string;
  metadata: Record<string, unknown>;
}): Promise<{ ok: true; payment: CoinpayPayment } | { ok: false; error: string }> {
  if (!env.coinpayConfigured) {
    return { ok: false, error: "Payments are not configured on this server." };
  }
  try {
    const res = await fetch(`${env.coinpay.baseUrl}/payments/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.coinpay.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_id: env.coinpay.businessId,
        amount: args.amountUsd,
        currency: "USD",
        blockchain: args.blockchain,
        description: args.description,
        metadata: args.metadata,
      }),
    });
    const data = (await res.json()) as { success?: boolean; payment?: CoinpayPayment; error?: string };
    if (!res.ok || !data.success || !data.payment) {
      return { ok: false, error: data.error || `CoinPay error (${res.status}).` };
    }
    return { ok: true, payment: data.payment };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Fetch current payment status from CoinPay. */
export async function getCoinpayPayment(id: string): Promise<CoinpayPayment | null> {
  if (!env.coinpayConfigured) return null;
  try {
    const res = await fetch(`${env.coinpay.baseUrl}/payments/${id}`, {
      headers: { Authorization: `Bearer ${env.coinpay.apiKey}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { payment?: CoinpayPayment } & CoinpayPayment;
    return data.payment ?? (data.id ? data : null);
  } catch {
    return null;
  }
}

/** CoinPay marks a payment done via these statuses. */
export function isPaymentPaid(status: string | undefined): boolean {
  return (
    status === "confirmed" ||
    status === "forwarded" ||
    status === "forwarding" ||
    status === "completed" ||
    status === "paid"
  );
}
