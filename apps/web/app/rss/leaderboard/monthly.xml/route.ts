import { getLeaderboard } from "@/lib/queries";
import { leaderboardToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rows = await getLeaderboard({ timeframe: "month" });
  const xml = leaderboardToFeed(rows, {
    title: "AIorNot.vote — Monthly leaderboard",
    link: `${env.appUrl}/leaderboard/monthly`,
    feedUrl: `${env.appUrl}/rss/leaderboard/monthly.xml`,
    description: "Top guessers this month.",
  });
  return rssResponse(xml);
}
