import { getMostFollowing } from "@/lib/social";
import { FollowBoard } from "@/components/FollowBoard";

export const metadata = { title: "Most following" };
export const dynamic = "force-dynamic";

export default async function MostFollowingPage() {
  const rows = await getMostFollowing(100);
  return <FollowBoard title="Most-active followers" rows={rows} activeHref="/leaderboard/following" countLabel="Following" />;
}
