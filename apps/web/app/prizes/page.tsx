import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { BASE_REWARDS, getLatestPack, getRecentWinners, getUserPrizes } from "@/lib/prizes";
import { ClaimButton } from "@/components/PrizeUI";

export const metadata = {
  title: "Weekly prizes",
  description: "Top the weekly leaderboard and win real prizes on AIorNot.vote.",
};
export const dynamic = "force-dynamic";

const RANK_LABEL = ["1st place", "2nd place", "3rd place"];

export default async function PrizesPage() {
  const user = await getCurrentUser();
  const [pack, winners, mine] = await Promise.all([
    getLatestPack(),
    getRecentWinners(12),
    user ? getUserPrizes(user.id) : Promise.resolve([]),
  ]);
  const claimable = mine.filter((p) => p.status === "unclaimed" && new Date(p.claimDeadline).getTime() > Date.now());

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 900 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Weekly <span className="ai">prizes</span></h1>
        <p>
          Finish in the top 3 of the <Link href="/leaderboard/weekly">weekly leaderboard</Link> and win.
          Winners are notified and have <strong>7 days to claim</strong> — unclaimed prizes roll into a future pack.
        </p>
      </div>

      {claimable.length > 0 && (
        <div className="notice warn">
          <div className="rss-title">🏆 You have a prize to claim!</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {claimable.map((p) => (
              <ClaimButton key={p.id} prizeId={p.id} rewardLabel={p.rewardLabel} />
            ))}
          </div>
        </div>
      )}

      <div className="section-head"><h2>This week&apos;s prize pack</h2></div>
      <div className="prize-pack">
        {BASE_REWARDS.map((r, i) => (
          <div key={r.kind} className={`prize-card r${i + 1}`}>
            <div className="rank">{RANK_LABEL[i]}</div>
            <div className="reward">{r.label}</div>
            <div className="winner">Awarded to the #{i + 1} weekly guesser.</div>
          </div>
        ))}
      </div>
      <p className="muted-sm">Minimum a few scored guesses to qualify. Unclaimed rewards from past weeks get added on top of this pack.</p>

      {pack.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 24 }}><h2>Latest draw</h2></div>
          <table className="lb-table">
            <thead><tr><th>Rank</th><th>Reward</th><th>Winner</th><th>Status</th></tr></thead>
            <tbody>
              {pack.map((p) => (
                <tr key={p.id}>
                  <td className="lb-rank">{p.rank}</td>
                  <td>{p.rewardLabel}{p.carriedOver ? " (rolled over)" : ""}</td>
                  <td className="muted-sm">{p.userId ? "awarded" : "—"}</td>
                  <td>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {winners.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 24 }}><h2>Recent winners</h2></div>
          <table className="lb-table">
            <thead><tr><th>Week</th><th>Rank</th><th>Winner</th><th>Reward</th></tr></thead>
            <tbody>
              {winners.map((w, i) => (
                <tr key={i}>
                  <td className="muted-sm">{new Date(w.periodStart).toLocaleDateString()}</td>
                  <td className="lb-rank">{w.rank}</td>
                  <td className="lb-name">{w.displayName}</td>
                  <td className="muted-sm">{w.rewardLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!user && (
        <p className="muted-sm" style={{ marginTop: 16 }}>
          <Link href="/signup">Create an account</Link> and start guessing to compete for this week&apos;s pack.
        </p>
      )}
    </div>
  );
}
