import type { Metadata } from "next";
import Script from "next/script";
import { FeedbackWidget } from "@profullstack/stack/feedback";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WinBanner } from "@/components/PrizeUI";
import { TipBar } from "@/components/TipBar";
import { getCurrentUser } from "@/lib/session";
import { getClaimablePrizes } from "@/lib/prizes";
import { getRandomTip } from "@/lib/tips";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "AIorNot.vote — Crowd-sourced AI image detection",
    template: "%s — AIorNot.vote",
  },
  description:
    "Can you tell AI from real? Play the crowd-sourced AI-detection game — vote on images, videos & posts, or get the crowd's verdict by API and RSS.",
  applicationName: "AIorNot.vote",
  authors: [{ name: "Profullstack, Inc.", url: "https://profullstack.com" }],
  creator: "Profullstack, Inc.",
  publisher: "Profullstack, Inc.",
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: "AIorNot.vote — Latest media" },
      ],
    },
  },
  openGraph: {
    siteName: "AIorNot.vote",
    type: "website",
    url: env.appUrl,
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const [claimable, tip] = await Promise.all([
    user ? getClaimablePrizes(user.id).catch(() => []) : Promise.resolve([]),
    getRandomTip(),
  ]);
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": `${env.appUrl}/#org`,
                name: "AIorNot.vote",
                url: env.appUrl,
                description:
                  "Crowd-sourced AI-vs-real detection: verified humans vote whether media is AI-generated or real.",
                founder: { "@type": "Organization", name: "Profullstack, Inc." },
                sameAs: [
                  "https://github.com/profullstack/aiornot.vote",
                  "https://profullstack.com",
                ],
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": `${env.appUrl}/#website`,
                name: "AIorNot.vote",
                url: env.appUrl,
                publisher: { "@id": `${env.appUrl}/#org` },
                potentialAction: {
                  "@type": "SearchAction",
                  target: `${env.appUrl}/search?q={search_term_string}`,
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@context": "https://schema.org",
                "@type": "WebApplication",
                name: "AIorNot.vote",
                url: env.appUrl,
                applicationCategory: "GameApplication",
                operatingSystem: "Any (web)",
                offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
                publisher: { "@id": `${env.appUrl}/#org` },
              },
            ]),
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader user={user} />
        <WinBanner prizes={claimable.map((p) => ({ id: p.id, rewardLabel: p.rewardLabel, claimDeadline: p.claimDeadline }))} />
        <TipBar tip={tip} />
        <main>{children}</main>
        <SiteFooter />
        {/* Profullstack feedback widget (feedback.profullstack.com) */}
        <FeedbackWidget property="aiornot.vote" />
        {/* CrawlProof analytics + ad network. Ad units are placed in the UI
            (see AdSlot in the footer); ad.js fills any [data-cp-ad] slot in a
            sandboxed iframe and never blocks page load. */}
        <Script data-site="8ad2116a-ae39-434a-8e2e-216931f80f43" src="https://crawlproof.com/stats.js" strategy="afterInteractive" />
        <Script src="https://crawlproof.com/ad.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
