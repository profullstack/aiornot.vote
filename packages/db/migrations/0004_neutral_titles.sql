-- Fix answer-revealing generated titles ("AI landscape", "Real x photo") that
-- leaked whether an item was AI or real. Rewrite to the neutral "AI or Not: X".
UPDATE media
  SET title = 'AI or Not: ' || upper(substr(title, 4, 1)) || substr(title, 5)
  WHERE seed_source = 'openai'
    AND title LIKE 'AI %'
    AND title NOT LIKE 'AI or Not:%';

UPDATE media
  SET title = 'AI or Not: ' || upper(substr(title, 6, 1)) || substr(title, 7, length(title) - 12)
  WHERE seed_source = 'manual'
    AND title LIKE 'Real % photo';
