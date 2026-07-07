import Link from "next/link";
import { listTags } from "@/lib/queries";
import { RssBar } from "@/components/RssBar";

export const metadata = { title: "Tags" };
export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await listTags({ hideSpoilers: true });
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Browse by tag</h2>
        <span className="sub">{tags.length} tags</span>
      </div>
      <RssBar feedPath="/feeds" title="Every tag has its own RSS feed" copy="Open the feed directory to grab any tag feed URL." />
      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {tags.map((t) => (
          <Link key={t.slug} href={`/t/${t.slug}`} className="chip">
            #{t.slug} <span className="muted-sm">· {t.mediaCount}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
