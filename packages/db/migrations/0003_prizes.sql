-- Weekly prize draws. Top players win a prize pack; winners must claim within a
-- week or the reward rolls into a later draw.
CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,   -- UTC ISO, Monday 00:00 of the drawn week
  period_end TEXT NOT NULL,     -- UTC ISO, following Monday 00:00
  rank INTEGER NOT NULL,        -- position in the prize pack (1 = top)
  reward_kind TEXT NOT NULL,    -- bittorrented_lifetime | crawlproof_50 | crawlproof_25
  reward_label TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'unclaimed'
    CHECK (status IN ('unclaimed', 'claimed', 'expired', 'rolled', 'fulfilled')),
  claim_deadline TEXT NOT NULL,
  claimed_at TEXT,
  fulfilled_at TEXT,
  notified_at TEXT,
  carried_over INTEGER NOT NULL DEFAULT 0,  -- reward rolled in from an expired prize
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_prizes_user_status ON prizes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_prizes_period ON prizes(period_start);
CREATE INDEX IF NOT EXISTS idx_prizes_status_deadline ON prizes(status, claim_deadline);
