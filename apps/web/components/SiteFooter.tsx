import Link from "next/link";
import { Footer as ProfullstackFooter } from "@profullstack/footer/react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-row">
        <nav className="footer-links">
          <Link href="/about">About</Link>
          <Link href="/feeds">RSS feeds</Link>
          <Link href="/api-docs">API</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/profullstack/aiornot.vote">Source</a>
        </nav>
      </div>
      {/* Copyright + Profullstack ring row, rendered server-side from the shared @latest template. */}
      <ProfullstackFooter site="https://aiornot.vote/" />
    </footer>
  );
}
