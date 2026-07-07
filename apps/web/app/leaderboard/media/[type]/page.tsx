import { notFound } from "next/navigation";
import { getLeaderboard } from "@/lib/queries";
import { LeaderboardView } from "@/components/LeaderboardView";

export const dynamic = "force-dynamic";

export default async function MediaLeaderboard({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (type !== "images" && type !== "videos") notFound();
  const mediaType = type === "images" ? "image" : "video";
  const rows = await getLeaderboard({ timeframe: "all", mediaType });
  return (
    <LeaderboardView
      title={`${type === "images" ? "Image" : "Video"} leaderboard`}
      rows={rows}
      activeHref={`/leaderboard/media/${type}`}
      feedPath="/rss/leaderboard.xml"
      note={`Correct guesses on ${mediaType} media only.`}
    />
  );
}
