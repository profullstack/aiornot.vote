-- Permit one CoinPay identity (sub) to be linked to multiple local accounts.
-- Each local account still has at most one CoinPay identity.
ALTER TABLE coinpay_identities DROP CONSTRAINT IF EXISTS coinpay_identities_pkey;
ALTER TABLE coinpay_identities DROP CONSTRAINT IF EXISTS coinpay_identities_user_id_key;
-- Use indexes rather than ALTER TABLE ADD PRIMARY KEY so the migration also
-- works through the libsql PostgreSQL compatibility layer used by dev2.
CREATE UNIQUE INDEX IF NOT EXISTS coinpay_identities_user_id_uq ON coinpay_identities(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS coinpay_identities_sub_user_id_uq ON coinpay_identities(sub, user_id);

CREATE TABLE IF NOT EXISTS coinpay_login_choices (
  token_hash TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS coinpay_login_choices_expires_idx ON coinpay_login_choices(expires_at);
