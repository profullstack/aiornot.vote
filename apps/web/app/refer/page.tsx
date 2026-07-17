import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getReferralStats } from "@/lib/referrals";
import { ShareLink, InviteForm } from "@/components/ReferUI";

export const metadata = {
  title: "Refer a friend",
  description: "Invite friends to AIorNot.vote and earn a coupon matching the weekly 1st-place prize for every friend who joins.",
};
export const dynamic = "force-dynamic";

export default async function ReferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/refer");

  if (!user.emailVerified) {
    return (
      <div className="container-narrow" style={{ padding: "32px 24px" }}>
        <h1>Refer a <span className="ai">friend</span></h1>
        <div className="notice warn" style={{ marginTop: 16 }}>
          <strong>Verify your email first.</strong> Once your account is verified you&apos;ll get a share link and
          can invite friends. <Link href="/account">Go to your account →</Link>
        </div>
      </div>
    );
  }

  const stats = await getReferralStats(user.id);

  return (
    <div className="container-narrow" style={{ padding: "32px 24px" }}>
      <div className="hero" style={{ padding: "8px 0 20px" }}>
        <h1>Refer a <span className="ai">friend</span>, get rewarded</h1>
        <p>
          There&apos;s no cost to play AIorNot.vote — so the best reward we can give you is the same one our{" "}
          <Link href="/prizes">weekly 1st-place winner</Link> gets. Every friend who joins with your link and
          verifies their email earns you a coupon:
        </p>
        <p style={{ fontSize: 16 }}><strong>🏆 {stats.rewardLabel}</strong></p>
        <p className="muted-sm">Rewards land on your <Link href="/prizes">Prizes</Link> page to claim (7 days to claim each).</p>
      </div>

      <div className="stat-tiles">
        <div className="tile"><div className="val">{stats.invited}</div><div className="lbl">Emails invited</div></div>
        <div className="tile"><div className="val">{stats.pending}</div><div className="lbl">Joined, not yet verified</div></div>
        <div className="tile"><div className="val human">{stats.rewarded}</div><div className="lbl">Rewards earned</div></div>
      </div>

      <div className="divider" />
      <div className="section-head"><h2 style={{ fontSize: 20 }}>Your share link</h2></div>
      <p className="muted">Reusable — share it anywhere. Everyone who signs up through it counts.</p>
      <ShareLink link={stats.link} />

      <div className="divider" />
      <div className="section-head"><h2 style={{ fontSize: 20 }}>Invite by email</h2></div>
      <InviteForm rewardLabel={stats.rewardLabel} />

      <p className="muted-sm" style={{ marginTop: 24 }}>
        Rewards are fulfilled by hand after a friend verifies — genuine invites only, please.
      </p>
    </div>
  );
}
