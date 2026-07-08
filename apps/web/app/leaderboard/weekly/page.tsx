import { getLeaderboard } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Weekly leaderboard" };
export const dynamic = "force-dynamic";

export default async function WeeklyLeaderboard() {
  const rows = await getLeaderboard({ timeframe: "week" });
  return (
    <LeaderboardView
      title="This week"
      rows={rows}
      activeHref="/leaderboard/weekly"
      feedPath="/rss/leaderboard/weekly.xml"
      note="Correct guesses this week (Monday start). Minimum 5 scored guesses to appear."
      scope={{ timeframe: "week", minScored: 1 }}
    />
  );
}
