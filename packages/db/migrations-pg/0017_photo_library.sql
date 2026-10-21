-- Photo library: a paid repository of licensed photos (human-made first).
-- Separate from the game's media table on purpose: library rows carry their
-- provenance in the open, and the game hides it until you guess.

-- 1) Widen payments.purpose to include 'library_pass'.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('api_access', 'lifetime_membership', 'play_pass', 'library_pass'));

-- 2) The pass: an ISO time the library stays unlocked until (extended per purchase).
ALTER TABLE users ADD COLUMN IF NOT EXISTS library_pass_until text;

-- 3) A contributor's opt-in: the untouched original kept privately for the library.
--    NULL means the submitter did not license the file.
ALTER TABLE media ADD COLUMN IF NOT EXISTS library_original_key text;

-- 4) The library itself.
CREATE TABLE IF NOT EXISTS library_photos (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  photographer text,
  photo_date text,
  credit_url text,
  source text NOT NULL CHECK (source IN ('contributor', 'met')),
  source_id text,
  license text NOT NULL CHECK (license IN ('contributor', 'cc0')),
  contributor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  media_id text,
  preview_url text NOT NULL,
  original_key text NOT NULL,
  mime_type text,
  width bigint,
  height bigint,
  file_size_bytes bigint,
  tags text,
  status text NOT NULL DEFAULT 'listed' CHECK (status IN ('listed', 'hidden')),
  download_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_library_source ON library_photos(source, source_id);
CREATE INDEX IF NOT EXISTS idx_library_status_created ON library_photos(status, created_at);

-- 5) One row per licensed download: the buyer's proof of license.
CREATE TABLE IF NOT EXISTS library_downloads (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_id text NOT NULL REFERENCES library_photos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_library_downloads_user ON library_downloads(user_id, created_at);
