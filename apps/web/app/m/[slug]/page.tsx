import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMediaBySlug, getRelatedMedia } from "@/lib/queries";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { toClientCard } from "@/lib/serialize";
import { DetailVote } from "@/components/DetailVote";
import { MediaGrid } from "@/components/MediaGrid";
import { RssBar } from "@/components/RssBar";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMediaBySlug(slug);
  if (!m) return { title: "Not found" };
  const img = m.thumbnailUrl || m.mediaUrl;
  return {
    title: m.title,
    description: `Guess whether this is AI or real. ${m.stats.totalGuesses} votes so far.`,
    alternates: { types: { "application/rss+xml": [{ url: `/rss/m/${m.slug}.xml`, title: m.title }] } },
    openGraph: { title: m.title, images: [img], type: "article" },
    twitter: { card: "summary_large_image", images: [img] },
  };
}

export default async function MediaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const m = await getMediaBySlug(slug, user?.id ?? null);
  if (!m) notFound();

  const relatedTagSlugs = m.tags.filter((t) => !t.isAnswerSpoiler).map((t) => t.slug);
  const related = await getRelatedMedia(m.id, relatedTagSlugs, 6);

  // Provenance is revealed after the user guesses (client-controlled).
  const provenance = (
    <div className="muted-sm">
      {m.sourceProvider === "openai" && (
        <p>
          <strong>AI-generated</strong>
          {m.aiModel ? ` with ${m.aiModel}` : ""}.
          {m.aiPromptSummary ? ` Prompt: ${m.aiPromptSummary}` : ""}
        </p>
      )}
      {m.unsplash && (
        <p>
          Real photo by{" "}
          {m.unsplash.photographerUrl ? (
            <a href={m.unsplash.photographerUrl} target="_blank" rel="noreferrer">
              {m.unsplash.photographerName}
            </a>
          ) : (
            m.unsplash.photographerName
          )}{" "}
          on{" "}
          <a href={m.unsplash.unsplashHtmlUrl || "https://unsplash.com"} target="_blank" rel="noreferrer">
            Unsplash
          </a>
          .
        </p>
      )}
      {m.sourceUrl && (
        <p>
          Source:{" "}
          <a href={m.sourceUrl} target="_blank" rel="noreferrer">
            {m.sourceDomain || m.sourceUrl}
          </a>
        </p>
      )}
    </div>
  );

  const visibleTags = m.tags.filter((t) => !t.isAnswerSpoiler);

  return (
    <div className="container">
      <div className="detail">
        <div className="detail-media">
          {m.mediaType === "video" ? (
            <video src={m.mediaUrl} poster={m.posterUrl || undefined} controls playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.mediaUrl} alt={m.title} />
          )}
        </div>

        <div>
          <h1>{m.title}</h1>
          <div className="meta-row">
            {m.mediaType.toUpperCase()} · submitted{" "}
            {new Date(m.createdAt + "Z").toLocaleDateString()}
          </div>
          {m.description && <p className="muted" style={{ marginTop: 8 }}>{m.description}</p>}

          {visibleTags.length > 0 && (
            <div className="card-tags" style={{ margin: "12px 0" }}>
              {visibleTags.map((t) => (
                <Link key={t.slug} href={`/t/${t.slug}`}>#{t.slug}</Link>
              ))}
            </div>
          )}

          <div className="divider" />
          <DetailVote
            card={toClientCard(m)}
            canGuess={canParticipate(user)}
            isLoggedIn={!!user}
            revealContent={m.userGuess ? provenance : undefined}
          />

          {user?.isAdmin && (
            <>
              <div className="divider" />
              <div className="muted-sm">
                <strong>Admin:</strong> truth = {m.truthLabel} ({m.truthConfidence}) ·{" "}
                <Link href={`/admin/media?q=${m.slug}`}>manage in admin →</Link>
              </div>
            </>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Related media</h2>
          </div>
          {relatedTagSlugs[0] && (
            <RssBar
              feedPath={`/rss/t/${relatedTagSlugs[0]}.xml`}
              title={`Follow #${relatedTagSlugs[0]} by RSS`}
              copy="Subscribe to a tag feed and get new media as it lands."
            />
          )}
          <MediaGrid cards={related.map(toClientCard)} canGuess={canParticipate(user)} isLoggedIn={!!user} />
        </section>
      )}
    </div>
  );
}
