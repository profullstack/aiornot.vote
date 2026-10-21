-- Photo library: a paid repository of licensed photos (human-made first).
-- Separate from the game's media table on purpose: library rows carry their
-- provenance in the open, and the game hides it until you guess.

-- 1) Widen payments.purpose to include 'library_pass' (in-place schema edit).
PRAGMA writable_schema = ON;
UPDATE sqlite_master
  SET sql = replace(sql, 'purpose IN (''api_access'', ''lifetime_membership'', ''play_pass'')', 'purpose IN (''api_access'', ''lifetime_membership'', ''play_pass'', ''library_pass'')')
  WHERE type = 'table' AND name = 'payments';
PRAGMA writable_schema = OFF;

-- 2) The pass: an ISO time the library stays unlocked until (extended per purchase).
ALTER TABLE users ADD COLUMN library_pass_until TEXT;

-- 3) A contributor's opt-in: the untouched original kept privately for the library.
--    NULL means the submitter did not license the file.
ALTER TABLE media ADD COLUMN library_original_key TEXT;

-- 4) The library itself.
CREATE TABLE IF NOT EXISTS library_photos (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  photographer TEXT,
  photo_date TEXT,
  credit_url TEXT,
  source TEXT NOT NULL,
  source_id TEXT,
  license TEXT NOT NULL,
  contributor_user_id TEXT,
  media_id TEXT,
  preview_url TEXT NOT NULL,
  original_key TEXT NOT NULL,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  file_size_bytes INTEGER,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'listed',
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_source ON library_photos(source, source_id);
CREATE INDEX IF NOT EXISTS idx_library_status_created ON library_photos(status, created_at);

-- 5) One row per licensed download: the buyer's proof of license.
CREATE TABLE IF NOT EXISTS library_downloads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  photo_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_library_downloads_user ON library_downloads(user_id, created_at);
