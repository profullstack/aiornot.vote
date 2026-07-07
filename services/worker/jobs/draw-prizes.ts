import "./_env.js";

/**
 * Weekly prize draw. Run once a week (e.g. Monday 00:10 UTC) via Railway cron.
 * Thin caller: hits the web app's secret-gated cron endpoint so the full draw
 * logic (winner emails, roll-over) lives in one place. Idempotent per week.
 *
 * Requires APP_URL and CRON_SECRET in the environment.
 */
async function main() {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; refusing to call the draw endpoint.");
    process.exit(1);
  }
  const res = await fetch(`${appUrl}/api/cron/draw-prizes`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });
  const body = await res.json().catch(() => ({}));
  console.log(`draw-prizes: ${res.status} ${JSON.stringify(body)}`);
  process.exit(res.ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
