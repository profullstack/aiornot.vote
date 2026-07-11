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
  if (value == null) return "SOL";
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase() || "SOL";
  return (COINPAY_BLOCKCHAINS as readonly string[]).includes(normalized)
    ? (normalized as CoinpayBlockchain)
    : null;
}
