-- One-time $1 "play pass" (required to play, site-wide) + admin promo codes.
-- Lifetime members already have play access, so the pass only matters for non-members.
ALTER TABLE users ADD COLUMN play_pass_at TEXT;

-- Admin-managed discount / comp codes.
CREATE TABLE IF NOT EXISTS promo_codes (
  code TEXT PRIMARY KEY,
  grants TEXT NOT NULL DEFAULT 'membership'      -- what redeeming grants
    CHECK (grants IN ('membership', 'play_pass')),
  active INTEGER NOT NULL DEFAULT 1,             -- admin toggles on/off
  max_uses INTEGER,                             -- NULL = unlimited
  uses INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One redemption per user per code.
CREATE TABLE IF NOT EXISTS promo_redemptions (
  code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code, user_id)
);

-- The comp code we hand out "when we feel like it". Grants full lifetime
-- membership (which includes play access). Toggle it from /admin/promos.
INSERT OR IGNORE INTO promo_codes (code, grants, active, note)
VALUES ('100PERCENTOFF', 'membership', 1, 'Full-access comp code');
