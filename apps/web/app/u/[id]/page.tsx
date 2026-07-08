import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/session";
import { getUserStats } from "@/lib/queries";
import { getPublicProfile, getFollowCounts, isFollowing } from "@/lib/social";
import { getBadges } from "@/lib/rewards";
import { FollowButton } from "@/components/FollowButton";
import { ShareStats } from "@/components/ShareStats";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicProfile(id);
  if (!p) return { title: "Player not found" };
  const stats = await getUserStats(p.id).catch(() => null);
  const desc = stats
    ? `${p.displayName} has ${stats.correctGuesses} correct AI-vs-real calls at ${Math.round(stats.accuracy * 100)}% accuracy (best streak ${stats.bestStreak}) on AIorNot.vote.`
    : `${p.displayName}'s AIorNot.vote stats and badges.`;
  return {
    title: `${p.displayName} — player profile`,
    description: desc,
    alternates: { canonical: `/u/${p.id}` },
    openGraph: { title: `${p.displayName} on AIorNot.vote`, description: desc, type: "profile" },
    twitter: { card: "summary_large_image", title: `${p.displayName} on AIorNot.vote`, description: desc },
  };
}

const Stat = ({ v, label, color }: { v: string | number; label: string; color?: string }) => (
  <div>
    <div style={{ fontSize: 22, fontFamily: "var(--unbounded)", fontWeight: 700, color }}>{v}</div>
    <div className="lbl" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-2)" }}>{label}</div>
  </div>
);

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === profile.id;
  const [stats, counts, followingViewer] = await Promise.all([
    getUserStats(profile.id),
    getFollowCounts(profile.id),
    viewer && !isSelf ? isFollowing(viewer.id, profile.id) : Promise.resolve(false),
  ]);
  const badges = getBadges(stats.bestStreak);

  const acc = Math.round(stats.accuracy * 100);
  const profileUrl = `${env.appUrl}/u/${profile.id}`;
  const shareText = isSelf
    ? `I've called ${stats.correctGuesses} AI-vs-real right at ${acc}% accuracy (best streak ${stats.bestStreak}🔥) on AIorNot.vote. Can you beat me?`
    : `${profile.displayName} has ${stats.correctGuesses} correct AI-vs-real calls at ${acc}% accuracy on AIorNot.vote. Can you beat them?`;

  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>{profile.displayName} {profile.isMember && <span title="Lifetime member">🏅</span>}</h2>
        <span className="sub">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
      </div>

      <div className="form-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
          <Stat v={stats.correctGuesses} label="Correct" color="var(--human)" />
          <Stat v={`${Math.round(stats.accuracy * 100)}%`} label="Accuracy" />
          <Stat v={stats.currentStreak} label="Streak" color="var(--ai)" />
          <Stat v={stats.bestStreak} label="Best" />
          <Stat v={counts.following} label="Following" />
        </div>
        <div>
          {isSelf ? (
            <Link href="/account" className="btn">Your account →</Link>
          ) : (
            <FollowButton targetId={profile.id} initialFollowing={followingViewer} initialFollowers={counts.followers} canFollow={!!viewer} />
          )}
        </div>
      </div>

      <div className="form-card" style={{ marginTop: 14 }}>
        <div className="rss-title">{isSelf ? "Share your stats" : `Share ${profile.displayName}'s stats`}</div>
        <div style={{ marginTop: 10 }}>
          <ShareStats url={profileUrl} text={shareText} />
        </div>
      </div>

      {badges.length > 0 && (
        <div className="form-card" style={{ marginTop: 14 }}>
          <div className="rss-title">Badges</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8 }}>
            {badges.map((b) => (
              <span key={b.streak} title={`${b.streak}-streak`}
                style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border-3)", background: "var(--panel-alt)", fontSize: 13 }}>
                {b.emoji} {b.badge}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="muted-sm" style={{ marginTop: 16 }}>
        <Link href="/leaderboard">← Leaderboard</Link> · <Link href="/leaderboard/followers">Most followed</Link>
      </p>
    </div>
  );
}
