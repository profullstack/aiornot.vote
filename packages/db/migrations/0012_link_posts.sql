-- Allow user-submitted link/text posts (crowd-verdict games). Widen the
-- media_type CHECK to include 'link' by editing the stored schema in place —
-- SQLite can't ALTER a CHECK, and an in-place edit avoids a risky full table
-- rebuild on the live volume DB. Verified against the libSQL client.
PRAGMA writable_schema = ON;
UPDATE sqlite_master
  SET sql = replace(sql, 'media_type IN (''image'', ''video'')', 'media_type IN (''image'', ''video'', ''link'')')
  WHERE type = 'table' AND name = 'media';
PRAGMA writable_schema = OFF;
