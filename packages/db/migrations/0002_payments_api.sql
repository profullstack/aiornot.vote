-- Payments (CoinPay), API keys, lifetime membership, and API-created opinions.

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('api_access', 'lifetime_membership')),
  amount_usd REAL NOT NULL,
  blockchain TEXT,
  coinpay_payment_id TEXT,
  payment_address TEXT,
  crypto_amount TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'granted', 'expired', 'failed')),
  granted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_coinpay ON payments(coinpay_payment_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

ALTER TABLE users ADD COLUMN is_lifetime_member INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN created_via_api INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN api_key_id TEXT;
CREATE INDEX IF NOT EXISTS idx_media_api_key ON media(api_key_id);
