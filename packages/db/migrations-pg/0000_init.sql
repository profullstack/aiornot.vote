-- AIorNot.vote Postgres schema: the whole schema as it stood when the data left
-- Turso (2026-09), generated from the live database with `npx libsql-pg
-- convert-schema` and reviewed. On Postgres this is migration 0000 and the
-- SQLite files 0001..0016 are already recorded as applied (the _migrations
-- table was copied with the data); add every new migration to both directories.
-- Types: INTEGER -> bigint, REAL -> double precision, TEXT with a CURRENT_TIMESTAMP
-- default -> timestamptz; INTEGER PRIMARY KEY -> identity.

-- applied_at: text column with a current-time default became timestamptz
-- applied_at: default CURRENT_TIMESTAMP -> now()
-- created_at: text column with a current-time default became timestamptz
-- updated_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  email_normalized text NOT NULL UNIQUE,
  email_verified_at text,
  password_hash text,
  display_name text,
  avatar_url text,
  status text NOT NULL DEFAULT 'pending_email_verification' CHECK (status IN ('pending_email_verification', 'active', 'suspended', 'deleted')),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at text,
  is_lifetime_member bigint NOT NULL DEFAULT 0,
  play_pass_at text,
  notifications_enabled bigint NOT NULL DEFAULT 1,
  referral_code text,
  referred_by text
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table email_verification_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  consumed_at text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  ip_hash text,
  user_agent_hash text,
  expires_at text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at text
);

-- created_at: text column with a current-time default became timestamptz
-- updated_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table media (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'link')),
  title text NOT NULL,
  description text,
  original_url text,
  storage_key text,
  media_url text NOT NULL,
  thumbnail_url text,
  poster_url text,
  source_url text,
  source_domain text,
  source_provider text CHECK (source_provider IN ('upload', 'url', 'unsplash', 'openai', 'admin')),
  seed_source text CHECK (seed_source IN ('unsplash', 'openai', 'manual', 'user_upload')),
  source_parent_media_id text REFERENCES media(id),
  submitter_user_id text REFERENCES users(id) ON DELETE SET NULL,
  submitter_claim text CHECK (submitter_claim IN ('ai', 'not_ai', 'unknown')),
  truth_label text NOT NULL DEFAULT 'unknown' CHECK (truth_label IN ('ai', 'not_ai', 'unknown')),
  truth_confidence text NOT NULL DEFAULT 'unverified' CHECK (truth_confidence IN ('seeded', 'admin_verified', 'user_claim', 'unverified')),
  reveal_status text NOT NULL DEFAULT 'revealed' CHECK (reveal_status IN ('hidden_until_guess', 'revealed', 'locked')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden', 'needs_review')),
  is_featured bigint NOT NULL DEFAULT 0,
  is_score_eligible bigint NOT NULL DEFAULT 1,
  width bigint,
  height bigint,
  duration_seconds double precision,
  mime_type text,
  file_size_bytes bigint,
  file_hash text,
  perceptual_hash text,
  ai_prompt_summary text,
  ai_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at text,
  locked_at text,
  created_via_api bigint NOT NULL DEFAULT 0,
  api_key_id text
);

-- imported_at: text column with a current-time default became timestamptz
-- imported_at: default CURRENT_TIMESTAMP -> now()
create table unsplash_photos (
  media_id text PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
  unsplash_id text NOT NULL UNIQUE,
  photographer_name text,
  photographer_username text,
  photographer_url text,
  unsplash_html_url text,
  unsplash_download_location text,
  blur_hash text,
  color text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  raw_json text
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table seed_batches (
  id text PRIMARY KEY,
  name text NOT NULL,
  source text NOT NULL CHECK (source IN ('unsplash', 'openai', 'mixed')),
  category text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  total_requested bigint NOT NULL DEFAULT 0,
  total_imported bigint NOT NULL DEFAULT 0,
  total_generated bigint NOT NULL DEFAULT 0,
  metadata_json text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at text
);

-- created_at: text column with a current-time default became timestamptz
-- updated_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table tags (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_default bigint NOT NULL DEFAULT 0,
  is_visible bigint NOT NULL DEFAULT 1,
  is_answer_spoiler bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  members_only bigint NOT NULL DEFAULT 0
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table media_tags (
  media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, tag_id)
);

-- created_at: text column with a current-time default became timestamptz
-- updated_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table guesses (
  id text PRIMARY KEY,
  media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guess text NOT NULL CHECK (guess IN ('ai', 'not_ai')),
  is_correct bigint,
  is_scored bigint NOT NULL DEFAULT 0,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_id, user_id)
);

-- updated_at: text column with a current-time default became timestamptz
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table media_stats (
  media_id text PRIMARY KEY REFERENCES media(id) ON DELETE CASCADE,
  ai_guesses bigint NOT NULL DEFAULT 0,
  not_ai_guesses bigint NOT NULL DEFAULT 0,
  total_guesses bigint NOT NULL DEFAULT 0,
  correct_guesses bigint NOT NULL DEFAULT 0,
  incorrect_guesses bigint NOT NULL DEFAULT 0,
  crowd_accuracy double precision NOT NULL DEFAULT 0,
  score_ai double precision NOT NULL DEFAULT 0,
  score_not_ai double precision NOT NULL DEFAULT 0,
  trending_score double precision NOT NULL DEFAULT 0,
  difficulty_score double precision NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at: text column with a current-time default became timestamptz
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table user_stats (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_guesses bigint NOT NULL DEFAULT 0,
  scored_guesses bigint NOT NULL DEFAULT 0,
  correct_guesses bigint NOT NULL DEFAULT 0,
  incorrect_guesses bigint NOT NULL DEFAULT 0,
  accuracy double precision NOT NULL DEFAULT 0,
  current_streak bigint NOT NULL DEFAULT 0,
  best_streak bigint NOT NULL DEFAULT 0,
  last_guess_at text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table submissions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  original_url text,
  storage_key text,
  title text,
  source_url text,
  suggested_tags text,
  submitter_claim text CHECK (submitter_claim IN ('ai', 'not_ai', 'unknown')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'spam', 'needs_review')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at text
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table audit_log (
  id text PRIMARY KEY,
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata_json text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table password_reset_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  consumed_at text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- updated_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table payments (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('api_access', 'lifetime_membership', 'play_pass')),
  amount_usd double precision NOT NULL,
  blockchain text,
  coinpay_payment_id text,
  payment_address text,
  crypto_amount text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'granted', 'expired', 'failed')),
  granted_at text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  promo_code text
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table api_keys (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  label text,
  is_active bigint NOT NULL DEFAULT 1,
  request_count bigint NOT NULL DEFAULT 0,
  last_used_at text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table prizes (
  id text PRIMARY KEY,
  period_start text NOT NULL,
  period_end text NOT NULL,
  rank bigint NOT NULL,
  reward_kind text NOT NULL,
  reward_label text NOT NULL,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unclaimed' CHECK (status IN ('unclaimed', 'claimed', 'expired', 'rolled', 'fulfilled')),
  claim_deadline text NOT NULL,
  claimed_at text,
  fulfilled_at text,
  notified_at text,
  carried_over bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'weekly'
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table tips (
  id text PRIMARY KEY,
  text text NOT NULL UNIQUE,
  is_active bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at: text column with a current-time default became timestamptz
-- updated_at: default CURRENT_TIMESTAMP -> now()
create table user_powerups (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  hints bigint NOT NULL DEFAULT 0,
  ai_scans bigint NOT NULL DEFAULT 0,
  ai_verdicts bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table ai_analyses (
  media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ai_scan', 'ai_verdict')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (media_id, kind)
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table powerup_uses (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_id text NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('hint', 'ai_scan', 'ai_verdict')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_id, kind)
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table prize_sponsorships (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE SET NULL,
  sponsor_name text NOT NULL,
  sponsor_url text,
  prize_label text NOT NULL,
  message text,
  amount_usd double precision NOT NULL,
  blockchain text,
  coinpay_payment_id text,
  payment_address text,
  crypto_amount text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'fulfilled', 'expired')),
  period_start text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at text
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table promo_codes (
  code text PRIMARY KEY,
  grants text NOT NULL DEFAULT 'membership' CHECK (grants IN ('membership', 'play_pass')),
  active bigint NOT NULL DEFAULT 1,
  max_uses bigint,
  uses bigint NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  percent_off bigint NOT NULL DEFAULT 100,
  applies_to text NOT NULL DEFAULT 'any'
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table promo_redemptions (
  code text NOT NULL,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, user_id)
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table follows (
  follower_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id)
);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table push_subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at text
);

CREATE INDEX idx_media_status_created_at ON media(status, created_at DESC);

CREATE INDEX idx_media_featured_created_at ON media(is_featured, created_at DESC);

CREATE INDEX idx_media_type_status_created_at ON media(media_type, status, created_at DESC);

CREATE INDEX idx_media_truth_label ON media(truth_label);

CREATE INDEX idx_media_source_domain ON media(source_domain);

CREATE INDEX idx_media_file_hash ON media(file_hash);

CREATE INDEX idx_media_perceptual_hash ON media(perceptual_hash);

CREATE INDEX idx_tags_slug ON tags(slug);

CREATE INDEX idx_media_tags_tag_id ON media_tags(tag_id);

CREATE INDEX idx_guesses_media_id ON guesses(media_id);

CREATE INDEX idx_guesses_user_id_created_at ON guesses(user_id, created_at DESC);

CREATE INDEX idx_guesses_user_scored ON guesses(user_id, is_scored, is_correct);

CREATE INDEX idx_media_stats_trending ON media_stats(trending_score DESC);

CREATE INDEX idx_user_stats_correct ON user_stats(correct_guesses DESC, accuracy DESC);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at);

CREATE INDEX idx_payments_user ON payments(user_id);

CREATE INDEX idx_payments_coinpay ON payments(coinpay_payment_id);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE INDEX idx_media_api_key ON media(api_key_id);

CREATE INDEX idx_prizes_user_status ON prizes(user_id, status);

CREATE INDEX idx_prizes_period ON prizes(period_start);

CREATE INDEX idx_prizes_status_deadline ON prizes(status, claim_deadline);

CREATE INDEX idx_powerup_uses_user ON powerup_uses(user_id);

CREATE INDEX idx_sponsorships_period ON prize_sponsorships(period_start, status);

CREATE INDEX idx_sponsorships_coinpay ON prize_sponsorships(coinpay_payment_id);

CREATE INDEX idx_follows_followee ON follows(followee_id);

CREATE INDEX idx_follows_follower ON follows(follower_id);

CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);

CREATE UNIQUE INDEX idx_users_referral_code ON users(referral_code);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table referral_invites (
  id text PRIMARY KEY,
  referrer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, email_normalized)
);

CREATE INDEX idx_referral_invites_referrer ON referral_invites(referrer_id);

-- created_at: text column with a current-time default became timestamptz
-- created_at: default CURRENT_TIMESTAMP -> now()
create table referrals (
  id text PRIMARY KEY,
  referrer_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded')),
  reward_prize_id text REFERENCES prizes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  rewarded_at text
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

create table rate_limits (
  bucket_key text PRIMARY KEY,
  bucket_count bigint NOT NULL DEFAULT 0,
  reset_at bigint NOT NULL
);
