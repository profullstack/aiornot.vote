-- AIorNot.vote initial schema
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  email_verified_at TEXT,
  password_hash TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_email_verification'
    CHECK (status IN ('pending_email_verification', 'active', 'suspended', 'deleted')),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  ip_hash TEXT,
  user_agent_hash TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  title TEXT NOT NULL,
  description TEXT,
  original_url TEXT,
  storage_key TEXT,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  poster_url TEXT,
  source_url TEXT,
  source_domain TEXT,
  source_provider TEXT CHECK (source_provider IN ('upload', 'url', 'unsplash', 'openai', 'admin')),
  seed_source TEXT CHECK (seed_source IN ('unsplash', 'openai', 'manual', 'user_upload')),
  source_parent_media_id TEXT REFERENCES media(id),
  submitter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  submitter_claim TEXT CHECK (submitter_claim IN ('ai', 'not_ai', 'unknown')),
  truth_label TEXT NOT NULL DEFAULT 'unknown' CHECK (truth_label IN ('ai', 'not_ai', 'unknown')),
  truth_confidence TEXT NOT NULL DEFAULT 'unverified'
    CHECK (truth_confidence IN ('seeded', 'admin_verified', 'user_claim', 'unverified')),
  reveal_status TEXT NOT NULL DEFAULT 'revealed'
    CHECK (reveal_status IN ('hidden_until_guess', 'revealed', 'locked')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'hidden', 'needs_review')),
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_score_eligible INTEGER NOT NULL DEFAULT 1,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  mime_type TEXT,
  file_size_bytes INTEGER,
  file_hash TEXT,
  perceptual_hash TEXT,
  ai_prompt_summary TEXT,
  ai_model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  locked_at TEXT
);

CREATE TABLE IF NOT EXISTS unsplash_photos (
  media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
  unsplash_id TEXT NOT NULL UNIQUE,
  photographer_name TEXT,
  photographer_username TEXT,
  photographer_url TEXT,
  unsplash_html_url TEXT,
  unsplash_download_location TEXT,
  blur_hash TEXT,
  color TEXT,
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  raw_json TEXT
);

CREATE TABLE IF NOT EXISTS seed_batches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('unsplash', 'openai', 'mixed')),
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  total_requested INTEGER NOT NULL DEFAULT 0,
  total_imported INTEGER NOT NULL DEFAULT 0,
  total_generated INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  is_answer_spoiler INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_tags (
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (media_id, tag_id)
);

CREATE TABLE IF NOT EXISTS guesses (
  id TEXT PRIMARY KEY,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guess TEXT NOT NULL CHECK (guess IN ('ai', 'not_ai')),
  is_correct INTEGER,
  is_scored INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (media_id, user_id)
);

CREATE TABLE IF NOT EXISTS media_stats (
  media_id TEXT PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
  ai_guesses INTEGER NOT NULL DEFAULT 0,
  not_ai_guesses INTEGER NOT NULL DEFAULT 0,
  total_guesses INTEGER NOT NULL DEFAULT 0,
  correct_guesses INTEGER NOT NULL DEFAULT 0,
  incorrect_guesses INTEGER NOT NULL DEFAULT 0,
  crowd_accuracy REAL NOT NULL DEFAULT 0,
  score_ai REAL NOT NULL DEFAULT 0,
  score_not_ai REAL NOT NULL DEFAULT 0,
  trending_score REAL NOT NULL DEFAULT 0,
  difficulty_score REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_guesses INTEGER NOT NULL DEFAULT 0,
  scored_guesses INTEGER NOT NULL DEFAULT 0,
  correct_guesses INTEGER NOT NULL DEFAULT 0,
  incorrect_guesses INTEGER NOT NULL DEFAULT 0,
  accuracy REAL NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,
  last_guess_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  original_url TEXT,
  storage_key TEXT,
  title TEXT,
  source_url TEXT,
  suggested_tags TEXT,
  submitter_claim TEXT CHECK (submitter_claim IN ('ai', 'not_ai', 'unknown')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'spam', 'needs_review')),
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified_at);
CREATE INDEX IF NOT EXISTS idx_media_status_created_at ON media(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_featured_created_at ON media(is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_type_status_created_at ON media(media_type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_truth_label ON media(truth_label);
CREATE INDEX IF NOT EXISTS idx_media_source_domain ON media(source_domain);
CREATE INDEX IF NOT EXISTS idx_media_file_hash ON media(file_hash);
CREATE INDEX IF NOT EXISTS idx_media_perceptual_hash ON media(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag_id ON media_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_guesses_media_id ON guesses(media_id);
CREATE INDEX IF NOT EXISTS idx_guesses_user_id_created_at ON guesses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guesses_user_scored ON guesses(user_id, is_scored, is_correct);
CREATE INDEX IF NOT EXISTS idx_media_stats_trending ON media_stats(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_correct ON user_stats(correct_guesses DESC, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
