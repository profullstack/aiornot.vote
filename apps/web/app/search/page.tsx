import Link from "next/link";
import type { Metadata } from "next";
import { listMedia, PAGE_SIZE, type ListSort } from "@/lib/queries";
import { toClientCard } from "@/lib/serialize";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { normalizePage } from "@/lib/pagination";
import { MediaGrid } from "@/components/MediaGrid";
import { RssBar } from "@/components/RssBar";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";
// Avoid infinite crawl traps: search result pages are not indexed.
export const metadata: Metadata = { title: "Search", robots: { index: false, follow: true } };

const SORTS: { key: ListSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "trending", label: "Trending" },
  { key: "hardest", label: "Hardest" },
  { key: "most_guessed", label: "Most guessed" },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const tag = sp.tag;
  const mediaType = sp.media_type === "video" || sp.media_type === "image" ? sp.media_type : undefined;
  const sort = (SORTS.find((s) => s.key === sp.sort)?.key || "newest") as ListSort;
  const featuredOnly = sp.featured === "1";
  const page = normalizePage(sp.page);

  const user = await getCurrentUser();
  const { items, total } = await listMedia({
    q,
    tagSlug: tag,
    mediaType,
    sort,
    featuredOnly,
    page,
    userId: user?.id ?? null,
  });

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (tag) baseQuery.set("tag", tag);
  if (mediaType) baseQuery.set("media_type", mediaType);
  if (sort !== "newest") baseQuery.set("sort", sort);
  if (featuredOnly) baseQuery.set("featured", "1");

  const rssQuery = new URLSearchParams();
  if (q) rssQuery.set("q", q);
  if (tag) rssQuery.set("tag", tag);
  const rssFeed = `/rss/search.xml${rssQuery.toString() ? `?${rssQuery.toString()}` : ""}`;

  const title = q ? `Results for “${q}”` : featuredOnly ? "Featured" : `Explore · ${sort}`;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>{title}</h2>
        <span className="sub">{total} items</span>
      </div>

      <form action="/search" method="get" className="hero-search" style={{ margin: "8px 0 12px", maxWidth: 520 }}>
        <input type="search" name="q" defaultValue={q} placeholder="Search media, tags, photographers…" />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="btn btn-primary" type="submit">Search</button>
      </form>

      <div className="tabs" style={{ marginBottom: 8 }}>
        {SORTS.map((s) => {
          const query = new URLSearchParams(baseQuery);
          query.set("sort", s.key);
          return (
            <Link key={s.key} href={`/search?${query.toString()}`} className={s.key === sort ? "active" : ""}>
              {s.label}
            </Link>
          );
        })}
        <Link href={`/search?${new URLSearchParams({ ...Object.fromEntries(baseQuery), media_type: "video" }).toString()}`} className={mediaType === "video" ? "active" : ""}>
          Videos
        </Link>
      </div>

      <RssBar feedPath={rssFeed} title="Search it once. Subscribe forever." copy="This search has its own RSS feed — save it in your reader." />
      <MediaGrid cards={items.map(toClientCard)} canGuess={canParticipate(user)} isLoggedIn={!!user} />
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/search" query={baseQuery.toString()} />
    </div>
  );
}
