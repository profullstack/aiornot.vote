import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/opinions/:id — public crowd results for an opinion (no auth). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await sqlClient.execute({
    sql: `SELECT m.id, m.slug, m.title, m.media_url, m.created_at,
                 COALESCE(ms.ai_guesses,0) ai, COALESCE(ms.not_ai_guesses,0) not_ai,
                 COALESCE(ms.total_guesses,0) total
          FROM media m LEFT JOIN media_stats ms ON ms.media_id = m.id
          WHERE m.id = ? AND m.status = 'approved' LIMIT 1`,
    args: [id],
  });
  const r = res.rows[0];
  if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ai = Number(r.ai);
  const notAi = Number(r.not_ai);
  const total = Number(r.total);
  const aiPct = total > 0 ? Math.round((ai / total) * 100) : 0;
  let verdict: "likely_ai" | "likely_not_ai" | "uncertain" | "insufficient_votes";
  if (total < 5) verdict = "insufficient_votes";
  else if (aiPct >= 60) verdict = "likely_ai";
  else if (aiPct <= 40) verdict = "likely_not_ai";
  else verdict = "uncertain";

  return NextResponse.json({
    id: r.id as string,
    title: r.title as string,
    image_url: r.media_url as string,
    url: `${env.appUrl}/m/${r.slug as string}`,
    votes: { ai, not_ai: notAi, total },
    ai_percent: aiPct,
    verdict,
    note: "Crowd opinion from verified voters, not a scientific AI detector.",
    created_at: r.created_at as string,
  });
}
