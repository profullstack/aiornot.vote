import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
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
          <Link href="/account">Your history</Link>
        </div>
      </div>
    </footer>
  );
}
