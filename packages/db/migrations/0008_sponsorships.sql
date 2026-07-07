-- User-funded ("sponsored") weekly prizes, paid via CoinPay.
CREATE TABLE IF NOT EXISTS prize_sponsorships (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  sponsor_name TEXT NOT NULL,
  sponsor_url TEXT,
  prize_label TEXT NOT NULL,
  message TEXT,
  amount_usd REAL NOT NULL,
  blockchain TEXT,
  coinpay_payment_id TEXT,
  payment_address TEXT,
  crypto_amount TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'fulfilled', 'expired')),
  period_start TEXT NOT NULL,   -- Monday of the sponsored week
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_sponsorships_period ON prize_sponsorships(period_start, status);
CREATE INDEX IF NOT EXISTS idx_sponsorships_coinpay ON prize_sponsorships(coinpay_payment_id);
