import { getClient } from "@aiornot/db";
import type { Client } from "@libsql/client";
import { SEED_CATEGORIES } from "./prompts";
// Imported lazily-at-call-time from the barrel; safe despite the cycle because
// these are hoisted function declarations only invoked inside seedPool().
import { importUnsplashBatch, createAiVariant, slugify } from "./index";

/** Run async tasks with a bounded concurrency; per-task failures are reported, not fatal. */
async function runPool(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
  onError: (msg: string) => void,
): Promise<void> {
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      try {
        await tasks[my]!();
      } catch (e) {
        onError(`task ${my + 1} failed: ${(e as Error).message}`);
      }
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
}

export type SeedPoolOptions = {
  /** Target number of real (Unsplash) photos per category. Default 10. */
  realPerCategory?: number;
  /** Target number of AI variants per category. Default 10. */
  aiPerCategory?: number;
  /** Categories to fill. Defaults to the full SEED_CATEGORIES list. */
  categories?: readonly string[];
  /** Parallel AI generations. Default 3 (OpenAI rate-limit friendly). */
  aiConcurrency?: number;
  client?: Client;
  log?: (msg: string) => void;
};

/**
 * Fill the media pool so users never wait on generation. For each category it
 * imports the shortfall of real Unsplash photos and generates the shortfall of
 * AI variants — idempotent and resumable (existing approved media count toward
 * the target, so re-running only tops up what's missing).
 */
export async function seedPool(
  opts: SeedPoolOptions = {},
): Promise<{ realImported: number; aiGenerated: number; skipped: string[] }> {
  const client = opts.client ?? getClient();
  const log = opts.log ?? ((m: string) => console.log(m));
  const categories = opts.categories ?? SEED_CATEGORIES;
  const realTarget = opts.realPerCategory ?? 10;
  const aiTarget = opts.aiPerCategory ?? 10;
  const concurrency = Math.max(1, opts.aiConcurrency ?? 3);
  const haveUnsplash = !!process.env.UNSPLASH_ACCESS_KEY;
  const haveOpenai = !!process.env.OPENAI_API_KEY;

  let realImported = 0;
  let aiGenerated = 0;
  const skipped: string[] = [];

  if (!haveUnsplash && realTarget > 0) skipped.push("real photos (UNSPLASH_ACCESS_KEY unset)");
  if (!haveOpenai && aiTarget > 0) skipped.push("AI variants (OPENAI_API_KEY unset)");

  for (const category of categories) {
    const catSlug = slugify(category.replace(/ photography$/, ""));

    const counts = await client.execute({
      sql: `SELECT
              SUM(CASE WHEN m.truth_label = 'not_ai' THEN 1 ELSE 0 END) AS real_n,
              SUM(CASE WHEN m.truth_label = 'ai' THEN 1 ELSE 0 END) AS ai_n
            FROM media m
            JOIN media_tags mt ON mt.media_id = m.id
            JOIN tags t ON t.id = mt.tag_id
            WHERE t.slug = ? AND m.status = 'approved'`,
      args: [catSlug],
    });
    const existReal = Number(counts.rows[0]?.real_n ?? 0);
    const existAi = Number(counts.rows[0]?.ai_n ?? 0);

    // --- Real photos (Unsplash) ---
    const realNeed = Math.max(0, realTarget - existReal);
    if (realNeed > 0 && haveUnsplash) {
      log(`[${category}] importing ${realNeed} real photo(s)…`);
      try {
        const r = await importUnsplashBatch({ query: category, count: realNeed, orientation: "portrait", client });
        realImported += r.imported;
        log(`[${category}] +${r.imported} real (target ${realTarget})`);
      } catch (e) {
        log(`[${category}] unsplash failed: ${(e as Error).message}`);
      }
    }

    // --- AI variants (OpenAI) ---
    const aiNeed = Math.max(0, aiTarget - existAi);
    if (aiNeed > 0 && haveOpenai) {
      // Use this category's real photos as inspiration captions where available.
      const insp = await client.execute({
        sql: `SELECT m.id, m.title FROM media m
              JOIN media_tags mt ON mt.media_id = m.id
              JOIN tags t ON t.id = mt.tag_id
              WHERE t.slug = ? AND m.truth_label = 'not_ai'
              ORDER BY RANDOM() LIMIT ?`,
        args: [catSlug, aiNeed],
      });
      const inspRows = insp.rows;
      log(`[${category}] generating ${aiNeed} AI variant(s) @ concurrency ${concurrency}…`);
      const before = aiGenerated;
      const tasks = Array.from({ length: aiNeed }, (_, i) => async () => {
        const parent = inspRows[i % Math.max(1, inspRows.length)];
        const caption = (parent?.title as string) || category;
        await createAiVariant(client, {
          category,
          caption,
          // Tell the model exactly what to depict so the image matches the
          // category it will be tagged under.
          tags: [catSlug],
          parentId: (parent?.id as string) ?? null,
          seed: i + Math.floor(Math.random() * 1e6),
        });
        aiGenerated += 1;
      });
      await runPool(tasks, concurrency, (msg) => log(`[${category}] ${msg}`));
      log(`[${category}] +${aiGenerated - before} AI (target ${aiTarget})`);
    }
  }

  return { realImported, aiGenerated, skipped };
}
