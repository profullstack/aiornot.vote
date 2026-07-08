import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { BuyButton } from "@/components/PaymentUI";

export const metadata = { title: "Get access" };
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Get <span className="ai">access</span></h1>
        <p>
          <strong>Playing is free</strong> — just <Link href="/login">sign in</Link> and verify your
          email, then vote on every image, video and post. Go lifetime for members-only extras.
        </p>
      </div>

      {/* Lifetime membership */}
      <div className="form-card">
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2>Lifetime membership — ${env.priceLifetimeUsd}</h2>
        </div>
        <ul className="muted" style={{ lineHeight: 1.9 }}>
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

      {user && !user.isMember && (
        <p className="muted-sm" style={{ marginTop: 14 }}>
          🎟️ Got a promo code? Enter it in the <strong>Promo code</strong> box next to either buy button —
          it discounts the price (or unlocks free for a 100%-off code).
        </p>
      )}

      <p className="muted-sm" style={{ marginTop: 14 }}>
        Just need programmatic access? Grab <Link href="/api">$1 API access</Link> instead.
      </p>
    </div>
  );
}
