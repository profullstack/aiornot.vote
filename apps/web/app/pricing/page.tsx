import Link from "next/link";
import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AIorNot.vote is free to play. Optional submit access, lifetime membership, and one-off API access are available via crypto.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="container-narrow" style={{ padding: "32px 24px", lineHeight: 1.7 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "AIorNot.vote",
            description: "Crowd-sourced AI-vs-real detection game and API.",
            offers: [
              { "@type": "Offer", name: "Play", price: "0", priceCurrency: "USD", url: `${env.appUrl}/play` },
              { "@type": "Offer", name: "Submit pass", price: String(env.pricePlayPassUsd), priceCurrency: "USD", url: `${env.appUrl}/membership` },
              { "@type": "Offer", name: "Lifetime membership", price: String(env.priceLifetimeUsd), priceCurrency: "USD", url: `${env.appUrl}/membership` },
              { "@type": "Offer", name: "API access", price: String(env.priceApiAccessUsd), priceCurrency: "USD", url: `${env.appUrl}/api` },
            ],
          }),
        }}
      />
      <h1>Pricing</h1>
      <p><strong>Playing is free.</strong> Paid tiers are optional and pay-once (crypto via CoinPay) — no subscriptions.</p>

      <div className="stat-tiles" style={{ marginTop: 16 }}>
        <div className="tile"><div className="val human">Free</div><div className="lbl">Play, streaks, leaderboards</div></div>
        <div className="tile"><div className="val">${env.pricePlayPassUsd}</div><div className="lbl">Submit pass</div></div>
        <div className="tile"><div className="val">${env.priceLifetimeUsd}</div><div className="lbl">Lifetime membership</div></div>
        <div className="tile"><div className="val">${env.priceApiAccessUsd}</div><div className="lbl">API access (one-off)</div></div>
      </div>

      <h2>What&apos;s included</h2>
      <ul>
        <li><strong>Free</strong> — play every image, video, and post; build streaks; earn power-ups; appear on the leaderboard. A free account keeps your progress.</li>
        <li><strong>Submit pass (${env.pricePlayPassUsd})</strong> — a one-time anti-spam pass for submitting new media and post links.</li>
        <li><strong>Lifetime membership (${env.priceLifetimeUsd})</strong> — members-only collection, a lifetime badge, and free API keys. Pay once, forever.</li>
        <li><strong>API access (${env.priceApiAccessUsd})</strong> — a one-off key for the <Link href="/api">Crowd-detection API</Link> if you don&apos;t need membership.</li>
      </ul>

      <h2>How does payment work?</h2>
      <p>
        Payments are one-time and processed in cryptocurrency via CoinPay. Digital access grants are
        non-refundable except where required by law. Get started on the{" "}
        <Link href="/membership">membership page</Link>.
      </p>
    </div>
  );
}
