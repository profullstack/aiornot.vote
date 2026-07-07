import { getLeaderboard } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const rows = await getLeaderboard({ timeframe: "all" });
  return (
    <LeaderboardView
      title="All-time leaderboard"
      rows={rows}
      activeHref="/leaderboard"
      feedPath="/rss/leaderboard.xml"
      note="Ranked by correct guesses, then accuracy. Minimum 5 scored guesses to appear."
      scope={{ timeframe: "all", minScored: 5 }}
    />
  );
}
