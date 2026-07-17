-- Refer-a-friend. A user shares a link (or invites emails); when a referred
-- friend signs up and verifies their email, the referrer earns a coupon that
-- MATCHES the weekly 1st-place prize (a free lifetime bittorrented.com
-- membership). No money changes hands, so matching the top weekly prize is the
-- richest reward we can offer.

-- Stable per-user share code + who referred this account (set once at signup).
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- Distinguish weekly-leaderboard prizes from referral-reward coupons so the
-- public weekly views (latest pack, recent winners, carry-over) ignore coupons.
ALTER TABLE prizes ADD COLUMN source TEXT NOT NULL DEFAULT 'weekly';

-- Emails a user invited by address (for their dashboard; may not convert).
CREATE TABLE IF NOT EXISTS referral_invites (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (referrer_id, email_normalized)
);
CREATE INDEX IF NOT EXISTS idx_referral_invites_referrer ON referral_invites(referrer_id);

-- A referred signup. Starts 'pending'; becomes 'rewarded' (with a prize coupon)
-- once the referred user verifies their email. One referral per referred user.
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rewarded')),
  reward_prize_id TEXT REFERENCES prizes(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rewarded_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
