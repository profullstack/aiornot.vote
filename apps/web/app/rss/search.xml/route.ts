import { listMedia } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";
import { normalizeSearchMediaType, normalizeSearchSort, searchFeedParams, searchPagePathFromParams } from "@/lib/search-feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const tag = url.searchParams.get("tag") || undefined;
  const mediaType = normalizeSearchMediaType(url.searchParams.get("media_type"));
  const sort = normalizeSearchSort(url.searchParams.get("sort"));
  const featuredOnly = url.searchParams.get("featured") === "1";
  const { items } = await listMedia({ q, tagSlug: tag, mediaType, sort, featuredOnly, pageSize: 50 });

  const feedUrl = new URL(`${env.appUrl}/rss/search.xml`);
  const params = searchFeedParams({ q, tag, mediaType, sort, featuredOnly });
  params.forEach((value, key) => feedUrl.searchParams.set(key, value));

  const label = q ? `“${q}”` : tag ? `#${tag}` : "all media";
  const xml = mediaCardsToFeed(items, {
    title: `AIorNot.vote — Search: ${label}`,
    link: `${env.appUrl}${searchPagePathFromParams(params)}`,
    feedUrl: feedUrl.toString(),
    description: `Media matching ${label}.`,
  });
  return rssResponse(xml);
}
