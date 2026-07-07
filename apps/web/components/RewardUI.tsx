"use client";
import { useState } from "react";
import Link from "next/link";

type Kind = "hint" | "ai_scan" | "ai_verdict";
type Balances = { hints: number; aiScans: number; aiVerdicts: number };

const META: Record<Kind, { emoji: string; name: string; streak: number; balKey: keyof Balances }> = {
  hint: { emoji: "💡", name: "Hint", streak: 10, balKey: "hints" },
  ai_scan: { emoji: "🔍", name: "AI Scan", streak: 20, balKey: "aiScans" },
  ai_verdict: { emoji: "🤖", name: "AI Verdict", streak: 50, balKey: "aiVerdicts" },
};

export function PowerupBar({
  mediaId,
  balances: initialBalances,
  unlocked: initialUnlocked,
  isLoggedIn,
}: {
  mediaId: string;
  balances: Balances;
  unlocked: Partial<Record<Kind, string>>;
  isLoggedIn: boolean;
}) {
  const [balances, setBalances] = useState(initialBalances);
  const [results, setResults] = useState<Partial<Record<Kind, string>>>(initialUnlocked);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function use(kind: Kind) {
    setBusy(kind);
    setErr(null);
    try {
      const res = await fetch("/api/rewards/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, kind }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not use that.");
        return;
      }
      setResults((r) => ({ ...r, [kind]: data.text }));
      setBalances(data.balances);
    } catch {
      setErr("Network error.");
    } finally {
      setBusy(null);
    }
  }

  if (!isLoggedIn) return null;

  return (
    <div className="powerups">
      <div className="powerups-head">Streak rewards</div>
      <div className="powerup-btns">
        {(Object.keys(META) as Kind[]).map((kind) => {
          const m = META[kind];
          const count = balances[m.balKey];
          const unlockedHere = results[kind] != null;
          const canUse = unlockedHere || count > 0;
          return (
            <button
              key={kind}
              className={`powerup-btn ${unlockedHere ? "used" : canUse ? "ready" : "locked"}`}
              disabled={busy === kind || (!canUse && !unlockedHere)}
              onClick={() => canUse && !unlockedHere && use(kind)}
              title={canUse ? "" : `Earn at a ${m.streak}-guess streak`}
            >
              {busy === kind ? "…" : `${m.emoji} ${m.name}`}
              {unlockedHere ? " ✓" : canUse ? ` (${count})` : ` 🔒 ${m.streak}🔥`}
            </button>
          );
        })}
      </div>
      {err && <div className="form-error">{err}</div>}
      {(Object.keys(results) as Kind[]).map((kind) =>
        results[kind] ? (
          <div key={kind} className="powerup-result">
            <div className="powerup-result-h">{META[kind].emoji} {META[kind].name}</div>
            <div className="powerup-result-b">{results[kind]}</div>
          </div>
        ) : null,
      )}
      <div className="muted-sm" style={{ marginTop: 6 }}>
        Build a correct-guess streak to earn Hints (10🔥), AI Scans (20🔥) and AI Verdicts (50🔥). <Link href="/rewards">How rewards work →</Link>
      </div>
    </div>
  );
}

export function BadgeRow({ badges }: { badges: Array<{ badge: string; emoji: string; streak: number }> }) {
  if (badges.length === 0) return null;
  return (
    <div className="badge-row">
      {badges.map((b) => (
        <span key={b.badge} className="badge-pill" title={`${b.streak}-streak`}>
          {b.emoji} {b.badge}
        </span>
      ))}
    </div>
  );
}
