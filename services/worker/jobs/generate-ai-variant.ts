import "./_env.js";
import { generateAiVariantsBatch } from "@aiornot/seed";

/**
 * Generate photorealistic AI variants inspired by imported Unsplash photos.
 * Usage: pnpm --filter @aiornot/worker seed:ai-variants [total] [batchSize]
 */
async function main() {
  const total = Number(process.argv[2]) || 100;
  const batchSize = Number(process.argv[3]) || Number(process.env.SEED_BATCH_SIZE) || 10;

  let generated = 0;
  while (generated < total) {
    const count = Math.min(batchSize, total - generated);
    console.log(`Generating ${count} AI variant(s)…`);
    try {
      const r = await generateAiVariantsBatch({ count });
      generated += r.generated;
      console.log(`  +${r.generated} (total ${generated}/${total})`);
      if (r.generated === 0) break;
    } catch (err) {
      console.error(`  failed: ${(err as Error).message}`);
      break;
    }
  }
  console.log(`Done. Generated ${generated} AI variants.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
