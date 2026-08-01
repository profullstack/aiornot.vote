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
    console.error(`[coinpay] create payment failed:`, (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}

export type CoinpayFetchResult =
  | { ok: true; payment: CoinpayPayment }
  | { ok: false; error: string };

/** Fetch current payment status from CoinPay with detailed error reporting. */
export async function getCoinpayPaymentDetailed(id: string): Promise<CoinpayFetchResult> {
  if (!env.coinpayConfigured) {
    return { ok: false, error: "CoinPay payments are not configured on this server." };
  }
  try {
    const res = await fetch(`${env.coinpay.baseUrl}/payments/${id}`, {
      headers: { Authorization: `Bearer ${env.coinpay.apiKey}` },
    });
    if (!res.ok) {
      const errText = `CoinPay status fetch failed for payment ${id}: HTTP ${res.status}`;
      console.error(`[coinpay] ${errText}`);
      return { ok: false, error: errText };
    }
    const data = (await res.json()) as { payment?: CoinpayPayment } & CoinpayPayment;
    const payment = data.payment ?? (data.id ? data : null);
    if (!payment) {
      const payloadErr = `CoinPay payment ${id} returned invalid or empty payment payload.`;
      console.error(`[coinpay] ${payloadErr}`);
      return { ok: false, error: payloadErr };
    }
    return { ok: true, payment };
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[coinpay] status fetch error for ${id}:`, msg);
    return { ok: false, error: msg };
  }
}

/** Fetch current payment status from CoinPay (returns null on failure/unconfigured). */
export async function getCoinpayPayment(id: string): Promise<CoinpayPayment | null> {
  const result = await getCoinpayPaymentDetailed(id);
  return result.ok ? result.payment : null;
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
