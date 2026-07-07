import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { BuyButton } from "@/components/PaymentUI";
import { PromoForm } from "@/components/PromoForm";

export const metadata = { title: "Get access" };
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Get <span className="ai">access</span></h1>
        <p>
          A one-time crypto payment keeps the bots out — that&apos;s what a human-vs-AI game needs to
          stay honest. Two tiers, pay once via CoinPay, forever.
        </p>
      </div>

      {/* Play pass */}
      <div className="form-card">
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2>Play pass — ${env.pricePlayPassUsd}</h2>
        </div>
        <ul className="muted" style={{ lineHeight: 1.9 }}>
          <li>🎮 <strong>Play the game</strong> — vote on every image, video and post</li>
          <li>🏆 Climb the leaderboards, build streaks, earn power-ups</li>
          <li>🚫 One-time — no subscription, keeps out drive-by AI bots</li>
        </ul>
        <div style={{ marginTop: 16 }}>
          {!user ? (
            <Link href="/login" className="btn btn-primary">Sign in to get your pass</Link>
          ) : user.canPlay ? (
            <div className="form-ok">You have play access — go <Link href="/play">play →</Link></div>
          ) : (
            <BuyButton purpose="play_pass" priceUsd={env.pricePlayPassUsd} label="Get the play pass" />
          )}
        </div>
      </div>

      {/* Lifetime membership */}
      <div className="form-card" style={{ marginTop: 18 }}>
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2>Lifetime membership — ${env.priceLifetimeUsd}</h2>
        </div>
        <ul className="muted" style={{ lineHeight: 1.9 }}>
          <li>✅ <strong>Includes play access</strong> — no separate pass needed</li>
          <li>🔞 Access the members-only <strong>#nsfw</strong> collection</li>
          <li>🏅 Lifetime <strong>Member</strong> badge on the leaderboard</li>
          <li>🔑 Create <strong>API keys for free</strong> (skip the $1 per-key charge)</li>
          <li>🚀 Priority as new features ship · 💛 Support an independent, RSS-first project</li>
        </ul>
        <div style={{ marginTop: 16 }}>
          {!user ? (
            <Link href="/login" className="btn btn-primary">Sign in to join</Link>
          ) : user.isMember ? (
            <div className="form-ok">You&apos;re a lifetime member — thank you! 💛</div>
          ) : (
            <BuyButton purpose="lifetime_membership" priceUsd={env.priceLifetimeUsd} label="Become a member" />
          )}
        </div>
      </div>

      {/* Promo code */}
      {user && !user.isMember && (
        <div className="form-card" style={{ marginTop: 18 }}>
          <div className="rss-title">Have a code?</div>
          <p className="muted-sm" style={{ marginBottom: 10 }}>Redeem a promo code for instant access.</p>
          <PromoForm />
        </div>
      )}

      <p className="muted-sm" style={{ marginTop: 14 }}>
        Just need programmatic access? Grab <Link href="/api">$1 API access</Link> instead.
      </p>
    </div>
  );
}
