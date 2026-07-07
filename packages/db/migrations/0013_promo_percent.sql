-- Percentage-based promo codes + fix the payments.purpose CHECK (which never
-- allowed 'play_pass', so a real $1 play-pass purchase would have failed insert).

-- 1) Widen payments.purpose to include 'play_pass' (in-place schema edit).
PRAGMA writable_schema = ON;
UPDATE sqlite_master
  SET sql = replace(sql, 'purpose IN (''api_access'', ''lifetime_membership'')', 'purpose IN (''api_access'', ''lifetime_membership'', ''play_pass'')')
  WHERE type = 'table' AND name = 'payments';
PRAGMA writable_schema = OFF;

-- 2) Discount fields on promo codes. percent_off drives the discount (100 = free
--    comp, the old behavior). applies_to limits which product a code discounts.
ALTER TABLE promo_codes ADD COLUMN percent_off INTEGER NOT NULL DEFAULT 100;
ALTER TABLE promo_codes ADD COLUMN applies_to TEXT NOT NULL DEFAULT 'any';

-- 3) Track which code a payment used (redemption recorded when the payment grants).
ALTER TABLE payments ADD COLUMN promo_code TEXT;

-- 4) Backfill known codes.
UPDATE promo_codes SET percent_off = 100 WHERE code = '100PERCENTOFF';
UPDATE promo_codes SET percent_off = 50 WHERE code = '50OFF';
