import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-row">
        <span>© {new Date().getFullYear()} AIorNot.vote</span>
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
    </footer>
  );
}
