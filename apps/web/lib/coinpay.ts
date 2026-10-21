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

/** Every CoinPay checkout from this site carries this as its property. */
export const PAYMENT_PROPERTY = "aiornot.vote";

/** Stored as the blockchain of a row opened as a hosted checkout session (the buyer picks the coin later). */
export const CHECKOUT_BLOCKCHAIN = "CHECKOUT";

export const CHECKOUT_WINDOW_MINUTES = 60;

/** A CoinPay hosted checkout session id. Rows store it in coinpay_payment_id. */
export function isCheckoutSessionId(ref: unknown): ref is string {
  return typeof ref === "string" && ref.startsWith("cs_");
}

export type CheckoutSessionArgs = {
  amountUsd: number;
  description: string;
  customerEmail: string;
  accountId: string;
  metadata: Record<string, unknown>;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string;
};

/** The POST /api/checkout/sessions body. */
export function checkoutSessionBody(args: CheckoutSessionArgs): Record<string, unknown> {
  return {
    amount: args.amountUsd,
    currency: "USD",
    description: args.description,
    customer_email: args.customerEmail,
    account_id: args.accountId,
    property: PAYMENT_PROPERTY,
    metadata: args.metadata,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    expires_in_minutes: CHECKOUT_WINDOW_MINUTES,
  };
}

export type CheckoutSession = { id: string; url: string; expires_at?: string };

/**
 * Open a CoinPay hosted checkout session. The buyer picks any coin the
 * business holds a wallet for, or PayPal, on CoinPay's page.
 */
export async function createCoinpayCheckoutSession(
  args: CheckoutSessionArgs,
): Promise<{ ok: true; session: CheckoutSession } | { ok: false; error: string }> {
  if (!env.coinpayConfigured) {
    return { ok: false, error: "Payments are not configured on this server." };
  }
  try {
    const res = await fetch(`${env.coinpay.baseUrl}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.coinpay.apiKey}`,
        "Content-Type": "application/json",
        ...(args.idempotencyKey ? { "Idempotency-Key": args.idempotencyKey } : {}),
      },
      body: JSON.stringify(checkoutSessionBody(args)),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; expires_at?: string; error?: string; code?: string };
    if (!res.ok || !data.id || !data.url) {
      return { ok: false, error: data.error || `CoinPay error (${res.status}).` };
    }
    // Only ever send buyers to CoinPay's own origin.
    const origin = new URL(env.coinpay.baseUrl).origin;
    const url = new URL(data.url, origin);
    if (url.origin !== origin) return { ok: false, error: "CoinPay returned an unexpected checkout URL." };
    return { ok: true, session: { id: data.id, url: url.toString(), expires_at: data.expires_at } };
  } catch (err) {
    console.error(`[coinpay] create checkout session failed:`, (err as Error).message);
    return { ok: false, error: (err as Error).message };
  }
}

/** The hosted checkout page for a session id. */
export function checkoutSessionUrl(sessionId: string): string {
  return `${new URL(env.coinpay.baseUrl).origin}/checkout/${encodeURIComponent(sessionId)}`;
}

/** Session status with the business key: open | paid | expired, or null when CoinPay cannot be asked. */
export async function getCheckoutSessionStatus(sessionId: string): Promise<string | null> {
  if (!env.coinpayConfigured) return null;
  try {
    const res = await fetch(`${env.coinpay.baseUrl}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${env.coinpay.apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { session?: { status?: string } };
    return data.session?.status ?? null;
  } catch {
    return null;
  }
}

/**
 * Status of whatever a row stores in coinpay_payment_id: a checkout session
 * (paid when the session is paid) or, for rows made before sessions, a payment.
 */
export async function getCoinpayReferenceStatus(ref: string): Promise<{ paid: boolean; status: string } | null> {
  if (isCheckoutSessionId(ref)) {
    const status = await getCheckoutSessionStatus(ref);
    if (!status) return null;
    return { paid: status === "paid", status: status === "open" ? "pending" : status };
  }
  const p = await getCoinpayPayment(ref);
  if (!p) return null;
  return { paid: isPaymentPaid(p.status), status: p.status || "pending" };
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
