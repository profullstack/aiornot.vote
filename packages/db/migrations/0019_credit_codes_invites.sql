-- Credit codes and scarce invites (@profullstack/redeem-credits,
-- @profullstack/affiliates). Neither package keeps an entitlement here: a
-- redeemed code and an invite bonus both extend users.library_pass_until, the
-- column a paid $9 library pass already extends. Their own tables (credit_*,
-- aff_*) are created by the packages' stores on first use (CREATE ... IF NOT
-- EXISTS); the affiliates DDL holds a plpgsql function this runner's
-- statement splitter cannot carry.

-- 1) An invite code captured at signup, held until the email is verified, so
--    the verification link counts in any browser (not only the one with the
--    /i/<code> cookie). Cleared when it is accepted or refused.
ALTER TABLE users ADD COLUMN pending_invite TEXT;

-- 2) One row per grant of library days that did not come from a payment. The
--    primary key makes each grant idempotent: a code is `code:<codeId>`, an
--    invite bonus `invite:<inviteId>:<inviter|invitee>`.
CREATE TABLE IF NOT EXISTS library_pass_grants (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  days INTEGER NOT NULL,
  granted_at TEXT NOT NULL,
  PRIMARY KEY (user_id, source)
);
CREATE INDEX IF NOT EXISTS idx_library_pass_grants_source ON library_pass_grants(source);
