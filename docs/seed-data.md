# Seed data

Two sources, both handled by `packages/seed` and driven by `services/worker`
CLIs (or small batches from `/admin/seed-batches`).

## Real photos — Unsplash (`not_ai`)
`importUnsplashBatch({ query, count, orientation })`:
- Searches Unsplash (`content_filter=high`), imports photo metadata, URLs,
  blur hash, colour, and photographer attribution into `media` + `unsplash_photos`.
- Truth label `not_ai`, confidence `seeded`, status `approved`.
- Tags: category slug + `photorealistic` + `human-made` (spoiler) + `image`.
- Triggers the Unsplash `download_location` endpoint per API guidelines.

```bash
pnpm --filter @aiornot/worker seed:unsplash 100 20   # total, per-category
```

## AI variants — OpenAI images (`ai`)
`generateAiVariantsBatch({ count })`:
- Picks recent Unsplash seeds as inspiration parents (`source_parent_media_id`).
- Builds a reveal-safe prompt (`packages/seed/src/prompts.ts`) that keeps the
  category but changes ≥3 creative details — photorealistic, **not** a copy.
- Generates with `AI_IMAGE_MODEL` (default `gpt-image-1`), uploads the PNG to R2,
  stores truth label `ai`, `ai_prompt_summary`, `ai_model`.
- Requires `OPENAI_API_KEY` **and** `R2_*` storage.

```bash
pnpm --filter @aiornot/worker seed:ai-variants 100 10   # total, batch size
```

## Targets
- Launch: 100 real + 100 AI (200 total).
- Full: 500 real + 500 AI (1,000 total).

## Local demo (no keys)
`pnpm seed:demo` inserts 12 media with `picsum.photos` placeholders and simulated
crowd stats so the app is fully browsable offline.
