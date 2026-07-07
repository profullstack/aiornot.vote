"use client";
import { useState } from "react";
import type { LeaderboardRow } from "@/lib/queries";

type SortKey = "rank" | "displayName" | "correct" | "scored" | "accuracy" | "currentStreak" | "bestStreak";

const COLS: Array<{ key: SortKey; label: string; numeric: boolean; className?: string }> = [
  { key: "rank", label: "Rank", numeric: true },
  { key: "displayName", label: "Player", numeric: false },
  { key: "correct", label: "Correct", numeric: true },
  { key: "scored", label: "Scored", numeric: true },
  { key: "accuracy", label: "Accuracy", numeric: true },
  { key: "currentStreak", label: "Streak", numeric: true },
  { key: "bestStreak", label: "Best", numeric: true },
];

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  // Default view = server ranking (rank ascending).
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "rank", dir: "asc" });

  function toggle(col: (typeof COLS)[number]) {
    setSort((s) =>
      s.key === col.key
        ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : // First click: numbers high→low (best first), names A→Z.
          { key: col.key, dir: col.numeric ? "desc" : "asc" },
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.dir === "asc" ? 1 : -1;
    if (sort.key === "displayName") return a.displayName.localeCompare(b.displayName) * dir;
    const av = a[sort.key] as number;
    const bv = b[sort.key] as number;
    if (av !== bv) return (av - bv) * dir;
    return a.rank - b.rank; // stable tiebreak on canonical rank
  });

  return (
    <table className="lb-table lb-sortable">
      <thead>
        <tr>
          {COLS.map((c) => {
            const active = sort.key === c.key;
            return (
              <th
                key={c.key}
                onClick={() => toggle(c)}
                aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                title={`Sort by ${c.label}`}
              >
                {c.label}
                <span style={{ opacity: active ? 1 : 0.25, marginLeft: 4, fontSize: 11 }}>
                  {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
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
  );
}
