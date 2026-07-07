import Link from "next/link";
import { MILESTONES } from "@/lib/rewards";

export const metadata = {
  title: "Streak rewards",
  description: "Build a correct-guess streak to unlock hints and AI-powered image analysis.",
};

export default function RewardsPage() {
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="hero" style={{ padding: "24px 0" }}>
        <h1>Streak <span className="ai">rewards</span></h1>
        <p>
          Every correct guess in a row builds your streak. Hit a milestone and you earn
          power-ups that <strong>stack up</strong> — spend them on any image&apos;s detail page.
          Miss one and the streak resets, but your earned rewards stay.
        </p>
      </div>

      <div className="section-head"><h2>The ladder</h2></div>
      <table className="lb-table">
        <thead><tr><th>Streak</th><th>Reward</th></tr></thead>
        <tbody>
          {MILESTONES.map((m) => (
            <tr key={m.streak}>
              <td className="lb-rank" style={{ color: "var(--ai)" }}>{m.streak}🔥</td>
              <td>{m.emoji} {m.label}{m.badge ? ` · 🏅 "${m.badge}" badge` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="section-head" style={{ marginTop: 24 }}><h2>The power-ups</h2></div>
      <div className="prize-pack">
        <div className="prize-card"><div className="rank">💡 Hint</div><div className="reward">A clue</div><div className="winner">Reveals the crowd&apos;s current lean plus a targeted thing to inspect.</div></div>
        <div className="prize-card"><div className="rank">🔍 AI Scan</div><div className="reward">What to look for</div><div className="winner">An AI points out specific regions/artifacts to zoom into — without giving the answer.</div></div>
        <div className="prize-card"><div className="rank">🤖 AI Verdict</div><div className="reward">Full opinion</div><div className="winner">An AI gives its verdict (AI or real) with reasoning and confidence.</div></div>
      </div>

      <p className="muted-sm" style={{ marginTop: 16 }}>
        Track your badges and balances on your <Link href="/account">account</Link>. Ready? <Link href="/play">Start a streak →</Link>
      </p>
    </div>
  );
}
