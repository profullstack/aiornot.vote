-- Members-only tags (e.g. #nsfw). Media carrying such a tag is hidden from the
-- default feed / play / RSS and only shown on the tag page to lifetime members.
ALTER TABLE tags ADD COLUMN members_only INTEGER NOT NULL DEFAULT 0;

-- The members-only #nsfw collection. Visible in tag lists (as a locked teaser),
-- but its media is gated behind lifetime membership.
INSERT OR IGNORE INTO tags (id, slug, name, description, is_default, is_visible, is_answer_spoiler, members_only)
VALUES ('tag_nsfw', 'nsfw', 'NSFW', 'Members-only: is it AI, or not? — the spicier collection.', 0, 1, 0, 1);

-- If the tag already existed, make sure it's flagged members-only.
UPDATE tags SET members_only = 1 WHERE slug = 'nsfw';
