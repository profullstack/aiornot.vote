-- Streak milestone rewards: consumable power-ups that stack up, plus a per-image
-- AI analysis cache. Badges are derived from user_stats.best_streak (no table).

CREATE TABLE IF NOT EXISTS user_powerups (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hints INTEGER NOT NULL DEFAULT 0,
  ai_scans INTEGER NOT NULL DEFAULT 0,
  ai_verdicts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Global cache of AI analyses per image (same image → same analysis, shared to
-- save cost). kind: 'ai_scan' (what to look for) | 'ai_verdict' (full opinion).
CREATE TABLE IF NOT EXISTS ai_analyses (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ai_scan', 'ai_verdict')),
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (media_id, kind)
);

-- Records that a user spent a power-up on a media item, so re-opening it shows
-- the unlocked result again without charging another power-up.
CREATE TABLE IF NOT EXISTS powerup_uses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('hint', 'ai_scan', 'ai_verdict')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, media_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_powerup_uses_user ON powerup_uses(user_id);
