import { getLeaderboard } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const metadata = { title: "Monthly leaderboard" };
export const dynamic = "force-dynamic";

export default async function MonthlyLeaderboard() {
  const rows = await getLeaderboard({ timeframe: "month" });
  return (
    <LeaderboardView
      title="This month"
      rows={rows}
      activeHref="/leaderboard/monthly"
      feedPath="/rss/leaderboard/monthly.xml"
      note="Correct guesses this calendar month. Minimum 5 scored guesses to appear."
      scope={{ timeframe: "month", minScored: 5 }}
    />
  );
}
