import "./_env.js";

/**
 * Pre-warm public RSS feeds by requesting them so downstream caches are hot.
 * Usage: pnpm --filter @aiornot/worker warm:feeds
 */
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FEEDS = [
  "/rss.xml",
  "/rss/trending.xml",
  "/rss/featured.xml",
  "/rss/leaderboard.xml",
  "/rss/leaderboard/weekly.xml",
  "/rss/leaderboard/monthly.xml",
];

async function main() {
  for (const path of FEEDS) {
    try {
      const res = await fetch(`${APP_URL}${path}`);
      console.log(`${res.status} ${path}`);
    } catch (err) {
      console.error(`fail ${path}: ${(err as Error).message}`);
    }
  }
  process.exit(0);
}

main();
