-- Game tips (shown at random on each page) + game-integrity cleanup.
CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO tips (id, text) VALUES
  ('tip_0001', 'Inspect hands for irregularities; AI often struggles with realistic finger placement'),
  ('tip_0002', 'Check teeth; AI-generated smiles can have unnatural gaps or unrealistic shapes'),
  ('tip_0003', 'Examine eyes for odd pupils; AI sometimes creates mismatched or oddly shaped eyes'),
  ('tip_0004', 'Look closely at ears; AI may produce distorted or oddly shaped ear features'),
  ('tip_0005', 'Analyze hair strands; AI often groups hair unnaturally or lacks detail in strands'),
  ('tip_0006', 'Evaluate jewelry; AI can create unrealistic reflections or poor detailing on accessories'),
  ('tip_0007', 'Observe glasses; AI might render reflections or distortions incorrectly in lenses'),
  ('tip_0008', 'Scan text in the image; AI-generated text often contains gibberish or misspellings'),
  ('tip_0009', 'Watch background people; AI may generate figures that lack realism in motion or form'),
  ('tip_0010', 'Check reflections; AI-generated reflections can appear unrealistic or missing entirely'),
  ('tip_0011', 'Look for symmetry; AI can create overly symmetrical features, which aren’t natural'),
  ('tip_0012', 'Spot repeated patterns; AI sometimes generates repetitive textures in backgrounds'),
  ('tip_0013', 'Inspect skin texture; AI often produces skin that looks too smooth and flawless'),
  ('tip_0014', 'Look for melty edges; AI can create warped outlines around objects or subjects'),
  ('tip_0015', 'Identify physically impossible details; AI might add odd elements that defy physics'),
  ('tip_0016', 'Examine lighting; inconsistent shadows can signal an AI-generated image'),
  ('tip_0017', 'Evaluate vehicles; check geometry; AI can misrepresent the shapes of bikes or scooters'),
  ('tip_0018', 'Search for tiling artifacts; AI may leave noticeable grid-like patterns in textures'),
  ('tip_0019', 'Use a magnifier to inspect people; AI details may falter under close examination'),
  ('tip_0020', 'Check the geometry of bicycles; AI often miscalculates proportions and angles'),
  ('tip_0021', 'Inspect shadows for unnatural directions; AI sometimes misaligns light sources'),
  ('tip_0022', 'Analyze clothing for odd folds; AI may render clothing with unnatural creases'),
  ('tip_0023', 'Look at the ground for unrealistic textures; AI can produce odd surfaces'),
  ('tip_0024', 'Observe facial features for unnatural proportions; AI can exaggerate or distort them');

-- Hide demo AI placeholders: these are real picsum photos mislabeled 'ai'
-- (fake truth) — they made the game unwinnable. Genuine OpenAI-generated
-- AI (served from /media/ai-variants) is unaffected.
UPDATE media SET status = 'hidden', updated_at = CURRENT_TIMESTAMP
  WHERE seed_source = 'openai' AND media_url LIKE '%picsum.photos%';
