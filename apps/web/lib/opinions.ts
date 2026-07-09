import "server-only";
import { sqlClient } from "./db";
import { env } from "./env";

export type PublicOpinionResult = {
  id: string;
  title: string;
  image_url: string;
  url: string;
  votes: { ai: number; not_ai: number; total: number };
  ai_percent: number;
  verdict: "likely_ai" | "likely_not_ai" | "uncertain" | "insufficient_votes";
  note: string;
  created_at: string;
};

async function isMembersOnlyMedia(mediaId: string): Promise<boolean> {
  const res = await sqlClient.execute({
    sql: `SELECT 1
          FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
          WHERE mt.media_id = ? AND t.members_only = 1
          LIMIT 1`,
    args: [mediaId],
  });
  return res.rows.length > 0;
}

export async function getPublicOpinionResult(id: string): Promise<PublicOpinionResult | null> {
  if (await isMembersOnlyMedia(id)) return null;

  const res = await sqlClient.execute({
    sql: `SELECT m.id, m.slug, m.title, m.media_url, m.created_at,
                 COALESCE(ms.ai_guesses,0) ai, COALESCE(ms.not_ai_guesses,0) not_ai,
                 COALESCE(ms.total_guesses,0) total
          FROM media m LEFT JOIN media_stats ms ON ms.media_id = m.id
          WHERE m.id = ? AND m.status = 'approved' LIMIT 1`,
    args: [id],
  });
  const r = res.rows[0];
  if (!r) return null;

  const ai = Number(r.ai);
  const notAi = Number(r.not_ai);
  const total = Number(r.total);
  const aiPct = total > 0 ? Math.round((ai / total) * 100) : 0;
  let verdict: PublicOpinionResult["verdict"];
  if (total < 5) verdict = "insufficient_votes";
  else if (aiPct >= 60) verdict = "likely_ai";
  else if (aiPct <= 40) verdict = "likely_not_ai";
  else verdict = "uncertain";

  return {
    id: r.id as string,
    title: r.title as string,
    image_url: r.media_url as string,
    url: `${env.appUrl}/m/${r.slug as string}`,
    votes: { ai, not_ai: notAi, total },
    ai_percent: aiPct,
    verdict,
    note: "Crowd opinion from verified voters, not a scientific AI detector.",
    created_at: r.created_at as string,
  };
}
