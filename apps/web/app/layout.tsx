import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getCurrentUser } from "@/lib/session";
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
        <main>{children}</main>
        <SiteFooter />
        {/* Profullstack feedback widget (feedback.profullstack.com) */}
        <Script
          src="https://feedback.profullstack.com/embed/profullstack-feedback.js"
          data-property="aiornot.vote"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
