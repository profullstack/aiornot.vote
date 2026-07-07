import "./_env.js";
import { importUnsplashBatch, SEED_CATEGORIES } from "@aiornot/seed";

/**
 * Import real photos from Unsplash across the seed categories.
 * Usage: pnpm --filter @aiornot/worker seed:unsplash [totalTarget] [perCategory]
 */
async function main() {
  const total = Number(process.argv[2]) || 100;
  const perCategory = Number(process.argv[3]) || Number(process.env.SEED_BATCH_SIZE) || 20;

  let imported = 0;
  for (const category of SEED_CATEGORIES) {
    if (imported >= total) break;
    const count = Math.min(perCategory, total - imported);
    console.log(`Importing ${count} from "${category}"…`);
    try {
      const r = await importUnsplashBatch({ query: category, count, orientation: "portrait" });
      imported += r.imported;
      console.log(`  +${r.imported} (total ${imported}/${total})`);
    } catch (err) {
      console.error(`  failed: ${(err as Error).message}`);
    }
  }
  console.log(`Done. Imported ${imported} real photos.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
