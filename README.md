# AIorNot.vote

A photorealistic image/video guessing game. Verified users decide whether media
is **AI-generated** or **real**, track a personal history, compete on
leaderboards, and subscribe to every list by **RSS**.

Built on the ProFullstack stack with **Postgres (via @profullstack/libsql-pg) + Drizzle schema**, **Next.js
15**, custom email/password auth (**Argon2id**), S3/R2 object storage, and
seeded from **Unsplash** (real photos) + **OpenAI image generation** (AI
variants). Deploys to **Railway**.

## Monorepo layout

```
apps/web            Next.js app: public pages, auth, guessing, RSS, admin
packages/db         Drizzle schema, SQL migrations (SQLite + Postgres editions), database client, seeders
packages/seed       Unsplash import + OpenAI variant generation (shared)
services/worker     CLI jobs: seed:unsplash, seed:ai-variants, recalc, warm-feeds
docs/               PRD, API, RSS, seed-data notes
```

## Quick start (local, no external keys needed)

```bash
bun install
cp .env.example .env            # local defaults use a file: SQLite db at repo root
bun run migrate                 # apply schema
bun run seed:tags               # 22 default tags
bun run seed:demo               # 12 demo media (placeholder images) + admin user
bun run dev                     # http://localhost:3000
```

The demo seed creates media with `picsum.photos` placeholders so the app renders
immediately. Email verification links are printed to the server console when
`RESEND_API_KEY` is unset. Sign up with the address in `ADMIN_EMAILS`
(`anthony@profullstack.com` by default) to get an admin account.

## Environment

See [`.env.example`](./.env.example). Nothing secret is committed. For
production set `DATABASE_URL` (postgres://...), `SESSION_SECRET`,
`RESEND_API_KEY`, the `R2_*` bucket vars, and (for seeding) `UNSPLASH_ACCESS_KEY`
+ `OPENAI_API_KEY`.

## Seeding real + AI media

```bash
# Real photos from Unsplash (needs UNSPLASH_ACCESS_KEY)
bun --filter @aiornot/worker seed:unsplash 100

# Photorealistic AI variants (needs OPENAI_API_KEY + R2_* storage)
bun --filter @aiornot/worker seed:ai-variants 100

# Recompute leaderboard/media stats from raw guesses (cron-safe)
bun --filter @aiornot/worker recalc:leaderboards
```

Admins can also trigger small seed batches from `/admin/seed-batches`.

## Photo library (`/library`)

A paid repository of licensed photos, separate from the game's media table
(library rows show provenance in the open; the game hides it until you guess).

- **Pass:** `library_pass` is a CoinPay purpose like the others. It costs
  `PRICE_LIBRARY_PASS_USD` (default 9) for `LIBRARY_PASS_DAYS` (default 30) of
  full-resolution downloads, capped at `LIBRARY_DAILY_DOWNLOADS` (default 100) a
  day. Buying again stacks the days. Promo codes with `applies_to = 'library_pass'` work.
- **Sources:** contributors tick "License it for the photo library" on `/submit`
  (uploaded JPEG/PNG/WebP, claimed not-AI). A moderator approves it, labels it
  `not_ai`, then clicks **Add to library** in `/admin/media`. Listing takes the
  item out of game scoring. The archive is public-domain (CC0) photographs from
  The Met's Open Access API.
- **Storage:** originals live in `LIBRARY_STORAGE_DIR` (default
  `$MEDIA_STORAGE_DIR/../.library-originals`, so `/data/.library-originals` in
  prod), which `/media` never serves. Pass holders get them from
  `/api/library/<id>/download`. Public previews are 960px watermarked WebP.
- **Unsplash/picsum photos are never listed:** their license forbids reselling them.

```bash
# Seed the archive with public-domain photographs from The Met
bun --filter @aiornot/worker seed:library 500
```

## Deploy (dev2)

Every merge to `master` deploys to dev2 (`.github/workflows/deploy-dev2.yml`),
which builds `.nixpacks/Dockerfile` (a hand-written Bun image; the path is the
one dev2's compose names). One container runs the migrations and seeds, then the
media daemon (`services/worker`) in the background and the web app in front.
The runtime is Bun: `bun install`, `bun run build`, and `bun <file>.ts` for the
CLIs (no tsx).

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
