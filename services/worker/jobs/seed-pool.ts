import "./_env.js";
import { seedPool } from "@aiornot/seed";

/**
 * Fill the media pool so users never wait on AI generation.
 * Usage: pnpm --filter @aiornot/worker seed:pool [realPerCategory] [aiPerCategory] [concurrency]
 * Example: pnpm --filter @aiornot/worker seed:pool 10 10 3
 *
 * Idempotent + resumable: existing approved media count toward the per-category
 * targets, so re-running only tops up the shortfall.
 */
async function main() {
  const realPer = process.argv[2] != null ? Number(process.argv[2]) : 10;
  const aiPer = process.argv[3] != null ? Number(process.argv[3]) : 10;
  const concurrency = Number(process.argv[4]) || Number(process.env.AI_CONCURRENCY) || 3;

  console.log(
    `Seeding pool: target ${realPer} real + ${aiPer} AI per category (AI concurrency ${concurrency}).`,
  );
  const res = await seedPool({
    realPerCategory: realPer,
    aiPerCategory: aiPer,
    aiConcurrency: concurrency,
  });
  if (res.skipped.length) console.log(`Skipped: ${res.skipped.join("; ")}`);
  console.log(`Done. Imported ${res.realImported} real photo(s), generated ${res.aiGenerated} AI variant(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
