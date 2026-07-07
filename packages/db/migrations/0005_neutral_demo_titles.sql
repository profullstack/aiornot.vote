-- Neutralise remaining seeded titles/descriptions that leaked the answer
-- (e.g. demo "hyperreal portrait shot", "A photorealistic AI-generated image").
UPDATE media
SET title = 'AI or Not: ' || COALESCE((
      SELECT upper(substr(tg.name, 1, 1)) || substr(tg.name, 2)
      FROM media_tags mt JOIN tags tg ON tg.id = mt.tag_id
      WHERE mt.media_id = media.id AND tg.is_answer_spoiler = 0
        AND tg.slug NOT IN ('image', 'video', 'photorealistic')
      ORDER BY tg.slug LIMIT 1
    ), 'Mystery image')
WHERE seed_source IN ('unsplash', 'openai', 'manual')
  AND title NOT LIKE 'AI or Not:%';

UPDATE media
SET description = 'Real photo or AI generation? Cast your vote.'
WHERE seed_source IN ('unsplash', 'openai', 'manual')
  AND description IN (
    'A photorealistic AI-generated image. Can you tell?',
    'A real photograph. Or is it?'
  );
