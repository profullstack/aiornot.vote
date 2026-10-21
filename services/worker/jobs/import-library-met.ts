import "./_env.js";
import { importMetPhotos } from "@aiornot/seed";

/**
 * Seed the photo library with public-domain (CC0) photographs from The Met.
 * Usage: bun --filter @aiornot/worker seed:library [count]
 */
async function main() {
  const count = Number(process.argv[2]) || 100;
  console.log(`Importing ${count} public-domain photographs from The Met…`);
  const r = await importMetPhotos({ count, log: (s) => console.log(s) });
  console.log(`Done. Imported ${r.imported} photos into the library.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
