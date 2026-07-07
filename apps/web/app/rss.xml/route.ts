import { listMedia } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { items } = await listMedia({ sort: "newest", pageSize: 50 });
  const xml = mediaCardsToFeed(items, {
    title: "AIorNot.vote — Latest media",
    link: env.appUrl,
    feedUrl: `${env.appUrl}/rss.xml`,
    description: "The newest photorealistic images and videos to guess AI or Not AI.",
  });
  return rssResponse(xml);
}
