export const COINPAY_BLOCKCHAINS = [
  "SOL",
  "POL",
  "ETH",
  "BTC",
  "USDC_ETH",
  "USDC_POL",
  "DOGE",
  "BCH",
  "BNB",
  "ADA",
] as const;

export type CoinpayBlockchain = (typeof COINPAY_BLOCKCHAINS)[number];

export function coinpayBlockchainLabel(blockchain: CoinpayBlockchain): string {
  return blockchain.replace("_", " ");
}

export function normalizeCoinpayBlockchain(value: unknown): CoinpayBlockchain | null {
  const normalized = String(value || "SOL").trim().toUpperCase();
  return (COINPAY_BLOCKCHAINS as readonly string[]).includes(normalized)
    ? (normalized as CoinpayBlockchain)
    : null;
}
