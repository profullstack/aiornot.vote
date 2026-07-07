import { listTags } from "@/lib/queries";
import { env } from "@/lib/env";
import { CopyButton } from "@/components/CopyButton";

export const metadata = { title: "RSS feed directory" };
export const dynamic = "force-dynamic";

function FeedRow({ path, label }: { path: string; label: string }) {
  const full = `${env.appUrl}${path}`;
  return (
    <div className="rss-bar">
      <div>
        <div className="rss-title">{label}</div>
        <div className="rss-copy">{full}</div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <a className="rss-link" href={path}>Open</a>
        <CopyButton text={full} />
      </div>
    </div>
  );
}

export default async function FeedsPage() {
  const tags = await listTags({ hideSpoilers: true });
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Every list has a feed</h1>
        <p>
          No algorithm. No doomscroll. Just RSS. Follow AIorNot.vote in Feedly,
          NetNewsWire, Thunderbird, or any reader — built for humans, feed
          readers, and AI agents.
        </p>
      </div>

      <div className="section-head"><h2>Core feeds</h2></div>
      <FeedRow path="/rss.xml" label="Latest media" />
      <FeedRow path="/rss/trending.xml" label="Trending media" />
      <FeedRow path="/rss/featured.xml" label="Featured media" />

      <div className="section-head" style={{ marginTop: 24 }}><h2>Leaderboard feeds</h2></div>
      <FeedRow path="/rss/leaderboard.xml" label="All-time leaderboard" />
      <FeedRow path="/rss/leaderboard/weekly.xml" label="Weekly leaderboard" />
      <FeedRow path="/rss/leaderboard/monthly.xml" label="Monthly leaderboard" />

      <div className="section-head" style={{ marginTop: 24 }}><h2>Tag feeds</h2></div>
      <p className="muted-sm">Every tag has a feed: <code>/rss/t/&lt;tag&gt;.xml</code></p>
      <div className="chips" style={{ justifyContent: "flex-start" }}>
        {tags.map((t) => (
          <a key={t.slug} href={`/rss/t/${t.slug}.xml`} className="chip">
            #{t.slug}.xml
          </a>
        ))}
      </div>

      <div className="notice" style={{ marginTop: 24 }}>
        <strong>Search feeds:</strong> add <code>/rss/search.xml?q=your+query</code> to follow any
        search — search it once, subscribe forever.
      </div>
    </div>
  );
}
