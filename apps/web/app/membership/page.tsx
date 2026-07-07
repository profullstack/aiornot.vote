import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { BuyButton } from "@/components/PaymentUI";

export const metadata = { title: "Lifetime membership" };
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Lifetime membership — ${env.priceLifetimeUsd}</h1>
        <p>One payment, forever. Pay in crypto via CoinPay.</p>
      </div>
      <div className="form-card">
        <ul className="muted" style={{ lineHeight: 1.9 }}>
          <li>🏅 Lifetime <strong>Member</strong> badge on the leaderboard</li>
          <li>🔑 Create <strong>API keys for free</strong> (skip the $1 per-key charge)</li>
          <li>🚀 Priority as new features ship</li>
          <li>💛 Support an independent, RSS-first, ad-free project</li>
        </ul>
        <div style={{ marginTop: 20 }}>
          {!user ? (
            <Link href="/login" className="btn btn-primary">Sign in to join</Link>
          ) : user.isMember ? (
            <div className="form-ok">You&apos;re already a lifetime member — thank you! 💛</div>
          ) : (
            <BuyButton purpose="lifetime_membership" priceUsd={env.priceLifetimeUsd} label="Become a member" />
          )}
        </div>
      </div>
      <p className="muted-sm">
        Just need programmatic access? Grab <Link href="/api">$1 API access</Link> instead.
      </p>
    </div>
  );
}
