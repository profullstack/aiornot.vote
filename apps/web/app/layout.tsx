import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WinBanner } from "@/components/PrizeUI";
import { getCurrentUser } from "@/lib/session";
import { getClaimablePrizes } from "@/lib/prizes";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl),
  title: {
    default: "AIorNot.vote — Crowd-sourced AI image detection",
    template: "%s — AIorNot.vote",
  },
  description:
    "Crowd-sourced AI image detection as a service. Verified humans vote whether a photorealistic image is AI-generated or real — get the crowd's verdict on the web, by RSS, or via API.",
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
  const claimable = user ? await getClaimablePrizes(user.id).catch(() => []) : [];
  return (
    <html lang="en">
      <head>
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
        <main>{children}</main>
        <SiteFooter />
        {/* Profullstack feedback widget (feedback.profullstack.com) */}
        <Script
          src="https://feedback.profullstack.com/embed/profullstack-feedback.js"
          data-property="aiornot.vote"
          strategy="afterInteractive"
        />
        {/* CrawlProof analytics + ad network. Ad units are placed in the UI
            (see AdSlot in the footer); ad.js fills any [data-cp-ad] slot in a
            sandboxed iframe and never blocks page load. */}
        <Script data-site="8ad2116a-ae39-434a-8e2e-216931f80f43" src="https://crawlproof.com/stats.js" strategy="afterInteractive" />
        <Script src="https://crawlproof.com/ad.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
