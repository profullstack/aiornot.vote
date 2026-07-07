import { listMedia } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { items } = await listMedia({ sort: "featured", featuredOnly: true, pageSize: 50 });
  const xml = mediaCardsToFeed(items, {
    title: "AIorNot.vote — Featured media",
    link: `${env.appUrl}/search?featured=1`,
    feedUrl: `${env.appUrl}/rss/featured.xml`,
    description: "Hand-picked featured media.",
  });
  return rssResponse(xml);
}
