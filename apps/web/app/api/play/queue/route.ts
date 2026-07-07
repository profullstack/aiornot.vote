import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sqlClient } from "@/lib/db";
import { getBalances } from "@/lib/rewards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a batch of approved media the signed-in user hasn't guessed yet. */
export async function GET() {
  const user = await getCurrentUser();
  const args: unknown[] = [];
  let notGuessed = "";
  if (user) {
    notGuessed = "AND m.id NOT IN (SELECT media_id FROM guesses WHERE user_id = ?)";
    args.push(user.id);
  }
  // Pull a random pool of candidates (truth_label is used ONLY server-side for
  // balancing — it is never sent to the client). We then interleave AI and
  // not-AI so a batch alternates classes instead of clumping, regardless of how
  // skewed the overall pool is.
  const res = await sqlClient.execute({
    sql: `SELECT m.id, m.slug, m.title, m.media_type, m.media_url, m.thumbnail_url, m.poster_url, m.truth_label
          FROM media m
          WHERE m.status = 'approved' AND m.truth_label IN ('ai','not_ai') ${notGuessed}
          ORDER BY RANDOM() LIMIT 60`,
    args: args as never[],
  });
  type Row = { id: string; slug: string; title: string; media_type: string; media_url: string; thumbnail_url: string | null; poster_url: string | null; truth_label: string };
  const rows = res.rows as unknown as Row[];
  const ai = rows.filter((r) => r.truth_label === "ai");
  const notAi = rows.filter((r) => r.truth_label === "not_ai");
  // Alternate classes, starting from whichever coin-flip, until we have 12 or run
  // out. If one class is exhausted, the rest fills from the other.
  const balanced: Row[] = [];
  let takeAi = Math.random() < 0.5;
  while (balanced.length < 12 && (ai.length || notAi.length)) {
    const pool = takeAi && ai.length ? ai : notAi.length ? notAi : ai;
    const row = pool.shift();
    if (row) balanced.push(row);
    takeAi = !takeAi;
  }
  const items = balanced.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    mediaType: r.media_type as "image" | "video",
    mediaUrl: r.media_url,
    thumbnailUrl: r.thumbnail_url ?? null,
    posterUrl: r.poster_url ?? null,
  }));
  const balances = user ? await getBalances(user.id) : { hints: 0, aiScans: 0, aiVerdicts: 0 };
  return NextResponse.json({ ok: true, items, balances });
}
