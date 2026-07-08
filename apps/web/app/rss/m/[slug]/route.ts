import { getMediaBySlug, getRelatedMedia, hasMembersOnlyTag } from "@/lib/queries";
import { mediaCardsToFeed } from "@/lib/rss";
import { rssResponse, stripXml } from "@/lib/rss-response";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = stripXml(raw);
  const m = await getMediaBySlug(slug);
  if (!m) return new Response("Not found", { status: 404 });
  if (hasMembersOnlyTag(m)) return new Response("Not found", { status: 404 });
  const tagSlugs = m.tags.filter((t) => !t.isAnswerSpoiler).map((t) => t.slug);
  const related = await getRelatedMedia(m.id, tagSlugs, 20);
  const items = [m, ...related];
  const xml = mediaCardsToFeed(items, {
    title: `AIorNot.vote — ${m.title} & related`,
    link: `${env.appUrl}/m/${slug}`,
    feedUrl: `${env.appUrl}/rss/m/${slug}.xml`,
    description: `${m.title} and related media.`,
  });
  return rssResponse(xml);
}
