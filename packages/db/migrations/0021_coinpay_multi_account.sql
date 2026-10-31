-- Permit one CoinPay identity (sub) to be linked to multiple local accounts.
-- Each local account still has at most one CoinPay identity.
ALTER TABLE coinpay_identities RENAME TO coinpay_identities_v20;

CREATE TABLE coinpay_identities (
  sub TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  contact_email TEXT,
  name TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  PRIMARY KEY (sub, user_id)
);

INSERT INTO coinpay_identities (sub, user_id, contact_email, name, created_at, last_login_at)
SELECT sub, user_id, contact_email, name, created_at, last_login_at FROM coinpay_identities_v20;

DROP TABLE coinpay_identities_v20;
CREATE INDEX coinpay_identities_sub_idx ON coinpay_identities(sub);

-- Short-lived, one-use challenge used only when CoinPay maps to multiple local
-- accounts. The raw random token is held in an HttpOnly cookie; only its hash
-- is stored here.
CREATE TABLE coinpay_login_choices (
  token_hash TEXT PRIMARY KEY,
  sub TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX coinpay_login_choices_expires_idx ON coinpay_login_choices(expires_at);
