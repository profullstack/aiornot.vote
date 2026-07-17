import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { LogoutButton } from "@/components/AuthForms";

export function Wordmark() {
  return (
    <Link href="/" className="wordmark" aria-label="AIorNot.vote home">
      <span className="ai">AI</span>
      <span className="or">or</span>
      <span className="not">NOT</span>
      <span className="dot">.vote</span>
    </Link>
  );
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="site-header">
      <Wordmark />
      <nav className="nav">
        <Link href="/">Latest</Link>
        <Link href="/search?sort=trending">Trending</Link>
        <Link href="/play">Play</Link>
        <Link href="/tags">Tags</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/rewards">Rewards</Link>
        <Link href="/prizes">Prizes</Link>
        <Link href="/refer">Refer</Link>
        <Link href="/feeds">Feeds</Link>
        <Link href="/api">API</Link>
        <Link href="/submit">Submit</Link>
      </nav>
      <div className="nav-auth">
        {user ? (
          <>
            {user.isAdmin && (
              <Link href="/admin" className="btn btn-sm">
                Admin
              </Link>
            )}
            <Link href="/account" className="btn btn-sm">
              {user.displayName || "Account"}
            </Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-sm btn-primary">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
