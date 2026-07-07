import "server-only";
import { sqlClient } from "./db";

/** A random active game tip (shown on each page). Null if the table is empty. */
export async function getRandomTip(): Promise<string | null> {
  try {
    const res = await sqlClient.execute("SELECT text FROM tips WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1");
    return (res.rows[0]?.text as string) ?? null;
  } catch {
    return null; // tips table may not exist yet (pre-migration)
  }
}
