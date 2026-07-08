import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMediaBySlug, getRelatedMedia, hasMembersOnlyTag } from "@/lib/queries";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { toClientCard } from "@/lib/serialize";
import { DetailVote } from "@/components/DetailVote";
import { MediaGrid } from "@/components/MediaGrid";
import { RssBar } from "@/components/RssBar";
import { Magnifier } from "@/components/Magnifier";
import { PowerupBar } from "@/components/RewardUI";
import { getMediaRewardState } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = await getMediaBySlug(slug);
  if (!m) return { title: "Not found" };
  if (hasMembersOnlyTag(m)) {
    return {
      title: "Members-only content",
      description: "This AIorNot.vote item is available to lifetime members.",
      robots: { index: false, follow: false },
      openGraph: { title: "Members-only content", type: "article" },
      twitter: { card: "summary" },
    };
  }
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

  // Members-only media (e.g. #nsfw): non-members get an upsell, not the content.
  if (hasMembersOnlyTag(m) && !user?.isMember) {
    return (
      <div className="container-narrow" style={{ paddingTop: 24 }}>
        <div className="form-card">
          <h1 style={{ fontSize: 20 }}>🔞 Members-only content</h1>
          <p className="muted" style={{ lineHeight: 1.8 }}>
            This one is part of the members-only <Link href="/t/nsfw">#nsfw</Link> collection.
            Unlock it — and the whole collection — with lifetime membership.
          </p>
          <div style={{ marginTop: 14 }}>
            {!user ? (
              <Link href="/login" className="btn btn-primary">Sign in</Link>
            ) : (
              <Link href="/membership" className="btn btn-primary">Unlock with membership →</Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const relatedTagSlugs = m.tags.filter((t) => !t.isAnswerSpoiler).map((t) => t.slug);
  const related = await getRelatedMedia(m.id, relatedTagSlugs, 6, { includeMembersOnly: !!user?.isMember });
  const rewardState = user ? await getMediaRewardState(user.id, m.id).catch(() => null) : null;

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
          {m.mediaType === "link" ? (
            <div style={{ background: "var(--panel-alt)", border: "1px solid var(--border-1)", borderRadius: 14, padding: "22px 24px" }}>
              <div className="muted-sm" style={{ textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                {m.sourceDomain || "post"}
              </div>
              <p style={{ margin: 0, fontSize: 18, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{m.description || m.title}</p>
            </div>
          ) : m.mediaType === "video" ? (
            <video src={m.mediaUrl} poster={m.posterUrl || undefined} controls playsInline />
          ) : (
            <Magnifier src={m.mediaUrl} alt={m.title} zoom={2.8} lensSize={220} />
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

          {rewardState && (
            <PowerupBar
              mediaId={m.id}
              balances={rewardState.balances}
              unlocked={rewardState.unlocked}
              isLoggedIn={!!user}
              hasVoted={!!m.userGuess}
            />
          )}

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
