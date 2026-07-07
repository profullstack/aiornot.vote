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
  const res = await sqlClient.execute({
    sql: `SELECT m.id, m.slug, m.title, m.media_type, m.media_url, m.thumbnail_url, m.poster_url
          FROM media m
          WHERE m.status = 'approved' AND m.truth_label IN ('ai','not_ai') ${notGuessed}
          ORDER BY RANDOM() LIMIT 12`,
    args: args as never[],
  });
  const items = res.rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    mediaType: r.media_type as "image" | "video",
    mediaUrl: r.media_url as string,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    posterUrl: (r.poster_url as string) ?? null,
  }));
  const balances = user ? await getBalances(user.id) : { hints: 0, aiScans: 0, aiVerdicts: 0 };
  return NextResponse.json({ ok: true, items, balances });
}
