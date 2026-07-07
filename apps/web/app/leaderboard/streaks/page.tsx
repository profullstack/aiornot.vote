import { getStreakLeaderboard } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Streak leaderboard" };
export const dynamic = "force-dynamic";

export default async function StreaksLeaderboard() {
  const rows = await getStreakLeaderboard();
  return (
    <LeaderboardView
      title="Longest active streaks"
      rows={rows}
      activeHref="/leaderboard/streaks"
      feedPath="/rss/leaderboard.xml"
      note="Ranked by current active streak of correct guesses."
      scope={{ timeframe: "all", minScored: 1 }}
    />
  );
}
