-- Sign in with CoinPay (2026-10-29). One row per CoinPay identity, bound to
-- the CoinPay sub only: CoinPay never verifies email addresses, so its email
-- is contact information and is never matched against users.email_normalized.
-- One CoinPay identity per account.
CREATE TABLE IF NOT EXISTS coinpay_identities (
  sub TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  contact_email TEXT,
  name TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- A started CoinPay authorization: the PKCE verifier and nonce stay
-- server-side, keyed by SHA-256 of the state, consumed once by the callback.
CREATE TABLE IF NOT EXISTS coinpay_oauth_pending (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  mode TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
