import Link from "next/link";
import type { FollowRankRow } from "@/lib/social";

const TABS = [
  { label: "All-time", href: "/leaderboard" },
  { label: "Weekly", href: "/leaderboard/weekly" },
  { label: "Monthly", href: "/leaderboard/monthly" },
  { label: "Streaks", href: "/leaderboard/streaks" },
  { label: "Most followed", href: "/leaderboard/followers" },
  { label: "Most following", href: "/leaderboard/following" },
];

export function FollowBoard({
  title,
  rows,
  activeHref,
  countLabel,
}: {
  title: string;
  rows: FollowRankRow[];
  activeHref: string;
  countLabel: string;
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
      {rows.length === 0 ? (
        <div className="empty">No follows yet — be the first to follow a player.</div>
      ) : (
        <table className="lb-table">
          <thead><tr><th>Rank</th><th>Player</th><th>{countLabel}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className={`lb-rank ${r.rank <= 3 ? "top" : ""}`}>{String(r.rank).padStart(2, "0")}</td>
                <td className="lb-name"><Link href={`/u/${r.userId}`}>{r.displayName}</Link></td>
                <td className="lb-correct">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
