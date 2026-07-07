import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserStats } from "@/lib/queries";
import { listApiKeys } from "@/lib/entitlements";
import { LogoutButton, ResendVerification } from "@/components/AuthForms";
import { ApiKeysManager } from "@/components/PaymentUI";

export const metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const stats = await getUserStats(user.id);
  const apiKeys = await listApiKeys(user.id);

  return (
    <div className="container-narrow" style={{ padding: "32px 24px" }}>
      <div className="section-head">
        <h2>
          {user.displayName || user.email}
          {user.isMember && <span className="badge-featured" style={{ position: "static", marginLeft: 10 }}>Member</span>}
        </h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/account/history" className="btn btn-sm">History</Link>
          <Link href="/account/settings" className="btn btn-sm">Settings</Link>
          <LogoutButton />
        </div>
      </div>

      {!user.emailVerified && (
        <div className="notice warn">
          <strong>Verify your email</strong> to start guessing and appear on leaderboards.
          {" "}
          <span className="muted-sm">(Check your inbox — in dev the link is printed to the server console.)</span>
          <div style={{ marginTop: 10 }}>
            <ResendVerification />
          </div>
        </div>
      )}

      <div className="stat-tiles">
        <div className="tile"><div className="val human">{stats.correctGuesses}</div><div className="lbl">Correct</div></div>
        <div className="tile"><div className="val">{stats.scoredGuesses}</div><div className="lbl">Scored guesses</div></div>
        <div className="tile"><div className="val">{Math.round(stats.accuracy * 100)}%</div><div className="lbl">Accuracy</div></div>
        <div className="tile"><div className="val ai">{stats.currentStreak}</div><div className="lbl">Streak</div></div>
        <div className="tile"><div className="val">{stats.bestStreak}</div><div className="lbl">Best streak</div></div>
        <div className="tile"><div className="val">{stats.totalGuesses}</div><div className="lbl">Total guesses</div></div>
      </div>

      <div className="divider" />
      <ApiKeysManager
        isMember={user.isMember}
        initialKeys={apiKeys.map((k) => ({ id: k.id, prefix: k.prefix, label: k.label, requestCount: k.requestCount, isActive: k.isActive }))}
      />
      {!user.isMember && (
        <p className="muted-sm" style={{ marginTop: 8 }}>
          <Link href="/membership">Become a lifetime member ($2)</Link> for free API keys + a badge, or{" "}
          <Link href="/api">buy one-off API access ($1)</Link>.
        </p>
      )}

      <div className="divider" />
      <p className="muted-sm">
        {user.isAdmin && (
          <>
            You&apos;re an admin. <Link href="/admin">Open the admin console →</Link>
            <br />
          </>
        )}
        Ready to test your eye? <Link href="/">Browse the latest media →</Link>
      </p>
    </div>
  );
}
