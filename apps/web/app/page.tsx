import { HomeHero } from "@/components/HomeHero";
import { FeedSection } from "@/components/FeedSection";
import { listTags } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const tags = await listTags({ defaultsOnly: true, hideSpoilers: true });
  return (
    <div className="container">
      <HomeHero tags={tags} />
      <FeedSection page={1} />
    </div>
  );
}
