import { getLeaderboard } from "@/lib/queries";
import { leaderboardToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rows = await getLeaderboard({ timeframe: "week" });
  const xml = leaderboardToFeed(rows, {
    title: "AIorNot.vote — Weekly leaderboard",
    link: `${env.appUrl}/leaderboard/weekly`,
    feedUrl: `${env.appUrl}/rss/leaderboard/weekly.xml`,
    description: "Top guessers this week.",
  });
  return rssResponse(xml);
}
