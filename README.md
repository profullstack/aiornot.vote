# AIorNot.vote

A photorealistic image/video guessing game. Verified users decide whether media
is **AI-generated** or **real**, track a personal history, compete on
leaderboards, and subscribe to every list by **RSS**.

Built on the ProFullstack stack with **Turso (SQLite) + Drizzle**, **Next.js
15**, custom email/password auth (**Argon2id**), S3/R2 object storage, and
seeded from **Unsplash** (real photos) + **OpenAI image generation** (AI
variants). Deploys to **Railway**.

## Monorepo layout

```
apps/web            Next.js app: public pages, auth, guessing, RSS, admin
packages/db         Drizzle schema, SQL migrations, Turso client, seeders
packages/seed       Unsplash import + OpenAI variant generation (shared)
services/worker     CLI jobs: seed:unsplash, seed:ai-variants, recalc, warm-feeds
docs/               PRD, API, RSS, seed-data notes
```

## Quick start (local, no external keys needed)

```bash
pnpm install
cp .env.example .env            # local defaults use a file: SQLite db at repo root
pnpm migrate                    # apply schema
pnpm seed:tags                  # 22 default tags
pnpm seed:demo                  # 12 demo media (placeholder images) + admin user
pnpm dev                        # http://localhost:3000
```

The demo seed creates media with `picsum.photos` placeholders so the app renders
immediately. Email verification links are printed to the server console when
`RESEND_API_KEY` is unset. Sign up with the address in `ADMIN_EMAILS`
(`anthony@profullstack.com` by default) to get an admin account.

## Environment

See [`.env.example`](./.env.example). Nothing secret is committed. For
production set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, `SESSION_SECRET`,
`RESEND_API_KEY`, the `R2_*` bucket vars, and (for seeding) `UNSPLASH_ACCESS_KEY`
+ `OPENAI_API_KEY`.

## Seeding real + AI media

```bash
# Real photos from Unsplash (needs UNSPLASH_ACCESS_KEY)
pnpm --filter @aiornot/worker seed:unsplash 100

# Photorealistic AI variants (needs OPENAI_API_KEY + R2_* storage)
pnpm --filter @aiornot/worker seed:ai-variants 100

# Recompute leaderboard/media stats from raw guesses (cron-safe)
pnpm --filter @aiornot/worker recalc:leaderboards
```

Admins can also trigger small seed batches from `/admin/seed-batches`.

## Deploy (Railway)

Two services share this repo (see [`railway.json`](./railway.json)):

- **web** — `pnpm install --frozen-lockfile && pnpm build`, start
  `pnpm --filter @aiornot/db migrate && pnpm --filter @aiornot/web start`.
- **worker** — runs the seed/recalc CLIs on a schedule.

## What's implemented

- Email/password auth with Argon2id, HTTP-only signed sessions, 30-minute
  verification tokens (hashed at rest), verification-gated guessing/uploads.
- Public feed, media detail (`/m/:slug`, `/i/:slug` → 308 redirect), tag pages,
  search with sort/filter, `/play` arena mode.
- Guessing: one guess per media per user, changeable until locked, crowd stats +
  correctness reveal, per-user + per-media stat rollups with streaks.
- Leaderboards: all-time / weekly / monthly / streaks / per-tag / per-media-type,
  each with an RSS feed and minimum-participation thresholds.
- RSS everywhere: latest, trending, featured, tag, search, per-media, and every
  leaderboard — with autodiscovery `<link>` tags and a `/feeds` directory.
- Uploads/submissions to R2 (SigV4) or external URL with SSRF guard; admin
  moderation queue, truth-label management (with re-scoring), tag admin, users.
- SEO: SSR pages, canonical metadata, OG/Twitter cards, `robots.txt`,
  `sitemap.xml`, search pages `noindex` to avoid crawl traps.

See [`docs/`](./docs) for the full PRD and API/RSS/seed references.
