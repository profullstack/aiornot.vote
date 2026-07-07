import { listMedia } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { items } = await listMedia({ sort: "trending", pageSize: 50 });
  const xml = mediaCardsToFeed(items, {
    title: "AIorNot.vote — Trending media",
    link: `${env.appUrl}/search?sort=trending`,
    feedUrl: `${env.appUrl}/rss/trending.xml`,
    description: "The media people are guessing on right now.",
  });
  return rssResponse(xml);
}
