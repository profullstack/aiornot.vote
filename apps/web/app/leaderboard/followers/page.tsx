import { getMostFollowed } from "@/lib/social";
import { FollowBoard } from "@/components/FollowBoard";

export const metadata = { title: "Most followed" };
export const dynamic = "force-dynamic";

export default async function MostFollowedPage() {
  const rows = await getMostFollowed(100);
  return <FollowBoard title="Most followed players" rows={rows} activeHref="/leaderboard/followers" countLabel="Followers" />;
}
