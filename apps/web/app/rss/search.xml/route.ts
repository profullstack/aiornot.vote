import { listMedia, type ListSort } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const tag = url.searchParams.get("tag") || undefined;
  const sort = (url.searchParams.get("sort") || "newest") as ListSort;
  const { items } = await listMedia({ q, tagSlug: tag, sort, pageSize: 50 });

  const feedUrl = new URL(`${env.appUrl}/rss/search.xml`);
  if (q) feedUrl.searchParams.set("q", q);
  if (tag) feedUrl.searchParams.set("tag", tag);

  const label = q ? `“${q}”` : tag ? `#${tag}` : "all media";
  const xml = mediaCardsToFeed(items, {
    title: `AIorNot.vote — Search: ${label}`,
    link: `${env.appUrl}/search?${feedUrl.searchParams.toString()}`,
    feedUrl: feedUrl.toString(),
    description: `Media matching ${label}.`,
  });
  return rssResponse(xml);
}
