import Link from "next/link";
import { Footer as ProfullstackFooter } from "@profullstack/footer/react";
import { AdSlot } from "./AdSlot";

const CRAWLPROOF_AD_SLOT = "38f34cb0-f9bd-4c68-a56f-9da6b7cc652f";

export function SiteFooter() {
  return (
    <div className="site-footer">
      <footer>
      <AdSlot slot={CRAWLPROOF_AD_SLOT} format="banner_300x250" />
      <div className="footer-grid">
        <div>
          <h4>AIorNot.vote</h4>
          <span className="muted-sm">
            No algorithm. No doomscroll. Just RSS. Built for humans, feed
            readers, and AI agents.
          </span>
        </div>
        <div>
          <h4>Explore</h4>
          <Link href="/">Latest</Link>
          <Link href="/search?sort=trending">Trending</Link>
          <Link href="/search?sort=hardest">Hardest</Link>
          <Link href="/tags">All tags</Link>
          <Link href="/leaderboard">Leaderboard</Link>
        </div>
        <div>
          <h4>RSS feeds</h4>
          <Link href="/rss.xml">Latest feed</Link>
          <Link href="/rss/trending.xml">Trending feed</Link>
          <Link href="/rss/featured.xml">Featured feed</Link>
          <Link href="/rss/leaderboard.xml">Leaderboard feed</Link>
          <Link href="/feeds">Feed directory</Link>
        </div>
        <div>
          <h4>Participate</h4>
          <Link href="/submit">Submit media</Link>
          <Link href="/signup">Create account</Link>
          <Link href="/api">Crowd-detection API</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
        </div>
      </div>
      </footer>
      {/* Copyright + Profullstack ring nav, rendered server-side from the shared @latest template. */}
      <ProfullstackFooter
        site="https://aiornot.vote/"
        links={[
          { label: "Terms", href: "/terms" },
          { label: "Privacy", href: "/privacy" },
          { label: "Source on GitHub ↗", href: "https://github.com/profullstack/aiornot.vote" },
        ]}
      />
    </div>
  );
}
