import Link from "next/link";
import type { LeaderboardRow } from "@/lib/queries";
import { getMyStanding } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { RssBar } from "./RssBar";

const TABS = [
  { label: "All-time", href: "/leaderboard" },
  { label: "Weekly", href: "/leaderboard/weekly" },
  { label: "Monthly", href: "/leaderboard/monthly" },
  { label: "Streaks", href: "/leaderboard/streaks" },
  { label: "Images", href: "/leaderboard/media/images" },
  { label: "Videos", href: "/leaderboard/media/videos" },
];

export async function LeaderboardView({
  title,
  rows,
  activeHref,
  feedPath,
  note,
  scope,
}: {
  title: string;
  rows: LeaderboardRow[];
  activeHref: string;
  feedPath: string;
  note?: string;
  scope?: { timeframe?: "all" | "week" | "month"; tagSlug?: string; mediaType?: "image" | "video"; minScored: number };
}) {
  const user = await getCurrentUser();
  const standing = user && scope ? await getMyStanding(user.id, scope) : null;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>{title}</h2>
        <div className="tabs">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={t.href === activeHref ? "active" : ""}>
              {t.label}
            </Link>
          ))}
        </div>
      </div>
      <RssBar feedPath={feedPath} title="Follow the leaderboard without logging in" copy="Leaderboards have RSS too — track the top guessers from your reader." />

      {standing && (
        <div className="notice warn" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="rss-title">Your standing</div>
            <div className="muted-sm">
              {standing.qualified
                ? "You're on this board — find your row below."
                : standing.scored === 0
                  ? "Vote on media to start scoring — your guesses count."
                  : `Cast ${standing.needed} more scored guess${standing.needed === 1 ? "" : "es"} to appear here.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 22, marginLeft: "auto", flexWrap: "wrap" }}>
            <div><div className="lb-correct" style={{ fontSize: 18 }}>{standing.correct}</div><div className="lbl" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-2)" }}>Correct</div></div>
            <div><div style={{ fontSize: 18, fontFamily: "var(--unbounded)", fontWeight: 700 }}>{standing.scored}</div><div className="lbl" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-2)" }}>Scored</div></div>
            <div><div style={{ fontSize: 18, fontFamily: "var(--unbounded)", fontWeight: 700 }}>{Math.round(standing.accuracy * 100)}%</div><div className="lbl" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-2)" }}>Accuracy</div></div>
            <div><div className="lb-streak" style={{ fontSize: 18, fontFamily: "var(--unbounded)", fontWeight: 700 }}>{standing.currentStreak}</div><div className="lbl" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted-2)" }}>Streak</div></div>
          </div>
        </div>
      )}

      {note && <p className="muted-sm">{note}</p>}
      {rows.length === 0 ? (
        <div className="empty">No qualifying players yet. Minimum scored guesses required to appear.</div>
      ) : (
        <table className="lb-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Correct</th>
              <th>Scored</th>
              <th>Accuracy</th>
              <th>Streak</th>
              <th>Best</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className={`lb-rank ${r.rank <= 3 ? "top" : ""}`}>{String(r.rank).padStart(2, "0")}</td>
                <td className="lb-name">{r.displayName}</td>
                <td className="lb-correct">{r.correct}</td>
                <td>{r.scored}</td>
                <td>{Math.round(r.accuracy * 100)}%</td>
                <td className="lb-streak">{r.currentStreak}</td>
                <td className="muted">{r.bestStreak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
