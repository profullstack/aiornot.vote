import Link from "next/link";
import { GRANT_EVERY, BADGE_TIERS } from "@/lib/rewards";

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
          Every correct guess in a row builds your streak, and you earn power-ups
          <strong> over and over</strong> as it climbs — not just once. They <strong>stack up</strong> in
          your balance to spend on any image&apos;s detail page. Miss one and the streak resets,
          but your earned rewards stay and you start earning again from the next guess.
        </p>
      </div>

      <div className="section-head"><h2>What you earn, and how often</h2></div>
      <table className="lb-table">
        <thead><tr><th>Every…</th><th>You earn</th></tr></thead>
        <tbody>
          <tr>
            <td className="lb-rank" style={{ color: "var(--ai)" }}>{GRANT_EVERY.hint} in a row</td>
            <td>💡 <strong>+1 Hint</strong> — again at {GRANT_EVERY.hint * 2}, {GRANT_EVERY.hint * 3}, {GRANT_EVERY.hint * 4}…</td>
          </tr>
          <tr>
            <td className="lb-rank" style={{ color: "var(--ai)" }}>{GRANT_EVERY.aiScan} in a row</td>
            <td>🔍 <strong>+1 AI Scan</strong> — again at {GRANT_EVERY.aiScan * 2}, {GRANT_EVERY.aiScan * 3}…</td>
          </tr>
          <tr>
            <td className="lb-rank" style={{ color: "var(--ai)" }}>{GRANT_EVERY.aiVerdict} in a row</td>
            <td>🤖 <strong>+1 AI Verdict</strong> — again at {GRANT_EVERY.aiVerdict * 2}, {GRANT_EVERY.aiVerdict * 3}…</td>
          </tr>
        </tbody>
      </table>
      <p className="muted-sm" style={{ marginTop: 8 }}>
        So a 20-streak run hands you 4 Hints (at 5, 10, 15, 20) <em>and</em> an AI Scan (at 20). Keep going and they keep coming.
      </p>

      <div className="section-head" style={{ marginTop: 24 }}><h2>Badges</h2></div>
      <p className="muted-sm" style={{ marginBottom: 8 }}>Permanent — awarded off your best-ever streak.</p>
      <table className="lb-table">
        <thead><tr><th>Best streak</th><th>Badge</th></tr></thead>
        <tbody>
          {BADGE_TIERS.map((t) => (
            <tr key={t.streak}>
              <td className="lb-rank" style={{ color: "var(--ai)" }}>{t.streak}🔥</td>
              <td>{t.emoji} 🏅 &ldquo;{t.badge}&rdquo;</td>
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
