import "./_env.js";
import { generateContinuousBatch } from "@aiornot/seed";

/**
 * Continuous media top-up daemon. Runs *alongside* the web app inside the same
 * Railway service (it needs the `/data` volume: the libSQL file at
 * TURSO_DATABASE_URL and the media files under MEDIA_STORAGE_DIR both live
 * there, and a Railway volume only mounts to one service). It replaces the old
 * standalone `aiornot-cron` service that curled POST /api/cron/generate-media —
 * here we call generateContinuousBatch in-process, so there is no HTTP hop and
 * no CRON_SECRET to keep in sync.
 *
 * Cadence: every GENERATE_MEDIA_INTERVAL_MINUTES (default 15), top up
 * GENERATE_MEDIA_COUNT (default 1) balanced item(s). Runs once at startup too.
 */
const intervalMinutes = Math.max(1, Number(process.env.GENERATE_MEDIA_INTERVAL_MINUTES) || 15);
const count = Math.min(10, Math.max(1, Number(process.env.GENERATE_MEDIA_COUNT) || 1));
const intervalMs = intervalMinutes * 60_000;

let running = false;
let stopping = false;

async function tick() {
  // Skip if the previous run is still going so slow batches never overlap.
  if (running) {
    console.warn("[generate-media] previous run still in progress — skipping this tick");
    return;
  }
  running = true;
  const startedAt = Date.now();
  try {
    const res = await generateContinuousBatch({ count });
    console.log(`[generate-media] ok ai=${res.ai} real=${res.real} (${Date.now() - startedAt}ms)`);
  } catch (err) {
    // Never let a single failure kill the loop — the next tick retries.
    console.error(`[generate-media] failed: ${(err as Error).message}`);
  } finally {
    running = false;
  }
}

function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[generate-media] ${signal} received — shutting down`);
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

console.log(`[generate-media] daemon up: every ${intervalMinutes}m, count=${count}`);
void tick();
setInterval(() => void tick(), intervalMs);
