# AIorNot.vote — PRD (summary)

**One-line:** a photorealistic image/video guessing game where verified users
decide whether media is AI-generated or real, track history, compete on
leaderboards, and subscribe to every list by RSS.

## Core loop
Sign up → verify email → see media → guess **AI** / **Not AI** → see correctness
(when a trusted `truth_label` exists) + crowd result → gain score/accuracy/streak
→ explore tags → subscribe by RSS.

## Decisions (as built)
- Accounts + verified email required for guessing, uploading, leaderboards.
- Anonymous visitors can browse approved media and all RSS feeds.
- Crowd percentages hidden until the user guesses; correct answer revealed after
  guess when the truth label is trusted (`seeded` / `admin_verified`).
- Only `ai` / `not_ai` truth labels are scored; `unknown` collects crowd guesses
  but never affects correctness.
- Truth labels canonical: `ai`, `not_ai`, `unknown`. Public tag for real photos
  is `human-made`; internal truth label is `not_ai`. `ai-generated` /
  `human-made` tags are answer-spoilers and hidden until after a guess.
- Files live in object storage (R2); Turso stores only metadata.
- Turso SQLite is the database of record; deploy target is Railway.

## Data model
See `packages/db/migrations/0000_init.sql` (source of truth) and
`packages/db/src/schema.ts` (Drizzle types). Tables: `users`,
`email_verification_tokens`, `sessions`, `media`, `unsplash_photos`,
`seed_batches`, `tags`, `media_tags`, `guesses`, `media_stats`, `user_stats`,
`submissions`, `audit_log`.

## Leaderboard eligibility
- All-time: ≥10 scored guesses. Weekly/monthly/tag: ≥5.
- Sort: correct desc → accuracy desc → scored desc → last activity desc.

## Milestones — status
M1 scaffold ✅ · M2 auth ✅ · M3 public browsing ✅ · M4 uploads/moderation ✅ ·
M5 guessing/scoring ✅ · M6 leaderboards ✅ · M7 seed pipeline ✅ (worker + admin) ·
M8 RSS ✅ · M9 launch polish (SEO, sitemap, robots, rate limits) ✅.
