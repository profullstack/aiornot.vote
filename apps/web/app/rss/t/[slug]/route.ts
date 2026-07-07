import { listMedia, getTagBySlug } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse, stripXml } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = stripXml(raw);
  const tag = await getTagBySlug(slug);
  if (!tag) return new Response("Not found", { status: 404 });
  const { items } = await listMedia({ tagSlug: slug, sort: "newest", pageSize: 50 });
  const xml = mediaCardsToFeed(items, {
    title: `AIorNot.vote — #${slug}`,
    link: `${env.appUrl}/t/${slug}`,
    feedUrl: `${env.appUrl}/rss/t/${slug}.xml`,
    description: `Media tagged #${slug}.`,
  });
  return rssResponse(xml);
}
