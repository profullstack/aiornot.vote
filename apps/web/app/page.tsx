import { HomeHero } from "@/components/HomeHero";
import { FeedSection } from "@/components/FeedSection";
import { CrowdPromo } from "@/components/CrowdPromo";
import { listTags } from "@/lib/queries";
import { sqlClient } from "@/lib/db";

export const dynamic = "force-dynamic";

async function num(sql: string): Promise<number> {
  const r = await sqlClient.execute(sql);
  return Number(r.rows[0]?.n ?? 0);
}

export default async function HomePage() {
  const [tags, images, votes, opinions] = await Promise.all([
    listTags({ defaultsOnly: true, hideSpoilers: true }),
    num("SELECT COUNT(*) n FROM media WHERE status='approved'"),
    num("SELECT COUNT(*) n FROM guesses"),
    num("SELECT COUNT(*) n FROM media WHERE created_via_api=1"),
  ]);
  return (
    <div className="container">
      <HomeHero tags={tags} />
      <CrowdPromo images={images} votes={votes} opinions={opinions} />
      <FeedSection page={1} />
    </div>
  );
}
