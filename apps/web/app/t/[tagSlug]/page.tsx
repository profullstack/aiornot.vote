import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTagBySlug, listMedia, PAGE_SIZE } from "@/lib/queries";
import { toClientCard } from "@/lib/serialize";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { MediaGrid } from "@/components/MediaGrid";
import { RssBar } from "@/components/RssBar";
import { Pagination } from "@/components/Pagination";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tagSlug: string }>;
}): Promise<Metadata> {
  const { tagSlug } = await params;
  const tag = await getTagBySlug(tagSlug);
  if (!tag) return { title: "Tag not found" };
  return {
    title: `#${tag.slug}`,
    description: `Media tagged #${tag.slug} — guess AI or Not AI.`,
    alternates: { types: { "application/rss+xml": [{ url: `/rss/t/${tag.slug}.xml`, title: `#${tag.slug}` }] } },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tagSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tagSlug } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const tag = await getTagBySlug(tagSlug);
  if (!tag) notFound();

  const user = await getCurrentUser();
  const { items, total } = await listMedia({
    tagSlug,
    sort: "newest",
    page,
    userId: user?.id ?? null,
  });

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>#{tag.slug}</h2>
        <span className="sub">{tag.mediaCount} items</span>
      </div>
      {tag.description && <p className="muted">{tag.description}</p>}
      <RssBar feedPath={`/rss/t/${tag.slug}.xml`} title={`Subscribe to #${tag.slug}`} copy="Every tag has a feed. Follow this one in any RSS reader." />
      <MediaGrid cards={items.map(toClientCard)} canGuess={canParticipate(user)} isLoggedIn={!!user} />
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath={`/t/${tag.slug}`} />
      <p className="muted-sm" style={{ marginTop: 16 }}>
        <Link href="/tags">← All tags</Link> · <Link href={`/leaderboard/t/${tag.slug}`}>Leaderboard for #{tag.slug}</Link>
      </p>
    </div>
  );
}
