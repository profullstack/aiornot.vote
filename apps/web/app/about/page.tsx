import Link from "next/link";
import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "About",
  description:
    "AIorNot.vote is a free game and crowd-sourced AI-detection service where verified humans vote whether media is AI-generated or real.",
  alternates: { canonical: "/about" },
};

const FAQ = [
  {
    q: "What is AIorNot.vote?",
    a: "A free game and crowd-sourced AI-detection service. Verified humans vote whether a photorealistic image, video, or post is AI-generated or real, and the aggregated crowd verdict is available on the web, by RSS, and via API.",
  },
  {
    q: "How do you play?",
    a: "Open Play, look at one item at a time, and call it AI or NOT. You build a streak for consecutive correct guesses and earn power-ups and badges. Playing is free — you get a few rounds as a guest, then a free account keeps your streak and puts you on the leaderboard.",
  },
  {
    q: "Is it free?",
    a: "Yes. Playing is completely free. An optional $2 lifetime membership adds perks (members-only collection, a badge, free API keys), and $1 one-off API access is available for developers.",
  },
  {
    q: "Who builds AIorNot.vote?",
    a: "It's built and operated by Profullstack, Inc. The project is open source on GitHub.",
  },
  {
    q: "Can I use the crowd verdict in my own app?",
    a: "Yes — the Crowd-detection API returns the crowd's AI-vs-real verdict programmatically. See the API page to get a key.",
  },
];

export default function AboutPage() {
  return (
    <div className="container-narrow" style={{ padding: "32px 24px", lineHeight: 1.7 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />
      <h1>About AIorNot.vote</h1>
      <p>
        <strong>AIorNot.vote</strong> is a free game and crowd-sourced AI-detection service.
        Verified humans vote whether a photorealistic image, video, or post is{" "}
        <a href="https://en.wikipedia.org/wiki/Synthetic_media" target="_blank" rel="noreferrer">
          AI-generated
        </a>{" "}
        or real. The aggregated verdict is available on the web, by RSS, and via API.
      </p>

      <h2>How it works</h2>
      <ul>
        <li><strong>Play:</strong> guess AI vs. real one item at a time and build a streak.</li>
        <li><strong>Crowd verdict:</strong> every vote sharpens the community&apos;s AI-vs-real call.</li>
        <li><strong>Get the data:</strong> read verdicts on the web, by <Link href="/feeds">RSS</Link>, or via the <Link href="/api">API</Link>.</li>
      </ul>

      <h2>Frequently asked questions</h2>
      {FAQ.map((f) => (
        <div key={f.q} style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>{f.q}</h3>
          <p style={{ marginTop: 0 }}>{f.a}</p>
        </div>
      ))}

      <p style={{ marginTop: 24 }}>
        Built by{" "}
        <a href="https://profullstack.com" target="_blank" rel="noreferrer">Profullstack, Inc.</a> ·{" "}
        <a href="https://github.com/profullstack/aiornot.vote" target="_blank" rel="noreferrer">Source on GitHub</a> ·{" "}
        <Link href="/pricing">Pricing</Link> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
      </p>
      <p className="muted-sm">
        Last updated <time dateTime="2026-07-08">July 8, 2026</time>. Play at{" "}
        <a href={env.appUrl}>{env.appUrl.replace(/^https?:\/\//, "")}</a>.
      </p>
    </div>
  );
}
