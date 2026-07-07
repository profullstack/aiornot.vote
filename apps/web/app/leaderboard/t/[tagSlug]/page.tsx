import { notFound } from "next/navigation";
import { getLeaderboard, getTagBySlug } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const dynamic = "force-dynamic";

export default async function TagLeaderboard({
  params,
}: {
  params: Promise<{ tagSlug: string }>;
}) {
  const { tagSlug } = await params;
  const tag = await getTagBySlug(tagSlug);
  if (!tag) notFound();
  const rows = await getLeaderboard({ timeframe: "all", tagSlug, minScored: 5 });
  return (
    <LeaderboardView
      title={`Leaderboard · #${tag.slug}`}
      rows={rows}
      activeHref={`/leaderboard/t/${tag.slug}`}
      feedPath={`/rss/leaderboard/t/${tag.slug}.xml`}
      note={`Correct guesses on #${tag.slug} media. Minimum 5 scored guesses to appear.`}
      scope={{ timeframe: "all", tagSlug, minScored: 5 }}
    />
  );
}
