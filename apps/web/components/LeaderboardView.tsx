import Link from "next/link";
import type { LeaderboardRow } from "@/lib/queries";
import { RssBar } from "./RssBar";

const TABS = [
  { label: "All-time", href: "/leaderboard" },
  { label: "Weekly", href: "/leaderboard/weekly" },
  { label: "Monthly", href: "/leaderboard/monthly" },
  { label: "Streaks", href: "/leaderboard/streaks" },
  { label: "Images", href: "/leaderboard/media/images" },
  { label: "Videos", href: "/leaderboard/media/videos" },
];

export function LeaderboardView({
  title,
  rows,
  activeHref,
  feedPath,
  note,
}: {
  title: string;
  rows: LeaderboardRow[];
  activeHref: string;
  feedPath: string;
  note?: string;
}) {
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
