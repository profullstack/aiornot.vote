import { getLeaderboard } from "@/lib/queries";
import { leaderboardToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rows = await getLeaderboard({ timeframe: "all" });
  const xml = leaderboardToFeed(rows, {
    title: "AIorNot.vote — All-time leaderboard",
    link: `${env.appUrl}/leaderboard`,
    feedUrl: `${env.appUrl}/rss/leaderboard.xml`,
    description: "Top guessers of all time.",
  });
  return rssResponse(xml);
}
