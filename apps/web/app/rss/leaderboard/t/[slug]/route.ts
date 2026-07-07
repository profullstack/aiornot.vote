import { getLeaderboard, getTagBySlug } from "@/lib/queries";
import { leaderboardToFeed } from "@/lib/rss";
import { rssResponse, stripXml } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = stripXml(raw);
  const tag = await getTagBySlug(slug);
  if (!tag) return new Response("Not found", { status: 404 });
  const rows = await getLeaderboard({ timeframe: "all", tagSlug: slug, minScored: 5 });
  const xml = leaderboardToFeed(rows, {
    title: `AIorNot.vote — Leaderboard #${slug}`,
    link: `${env.appUrl}/leaderboard/t/${slug}`,
    feedUrl: `${env.appUrl}/rss/leaderboard/t/${slug}.xml`,
    description: `Top guessers for #${slug}.`,
  });
  return rssResponse(xml);
}
