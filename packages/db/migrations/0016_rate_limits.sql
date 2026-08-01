-- Shared fixed-window rate limit buckets, stored in the database so limits
-- hold across multiple app instances (fixes #91).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  bucket_count INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
