"use client";
import { useState } from "react";
import Link from "next/link";

type Kind = "hint" | "ai_scan" | "ai_verdict";
type Balances = { hints: number; aiScans: number; aiVerdicts: number };

// `every` = how often you re-earn this power-up as your streak climbs (see lib/rewards.ts GRANT_EVERY).
const META: Record<Kind, { emoji: string; name: string; every: number; balKey: keyof Balances }> = {
  hint: { emoji: "💡", name: "Hint", every: 5, balKey: "hints" },
  ai_scan: { emoji: "🔍", name: "AI Scan", every: 20, balKey: "aiScans" },
  ai_verdict: { emoji: "🤖", name: "AI Verdict", every: 50, balKey: "aiVerdicts" },
};

export function PowerupBar({
  mediaId,
  balances: initialBalances,
  unlocked: initialUnlocked,
  isLoggedIn,
  hasVoted,
}: {
  mediaId: string;
  balances: Balances;
  unlocked: Partial<Record<Kind, string>>;
  isLoggedIn: boolean;
  hasVoted: boolean;
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

  // A Hint only helps before you guess — don't offer it once you've voted
  // (but still show one you already unlocked). Scans/Verdicts stay available.
  const kinds = (Object.keys(META) as Kind[]).filter(
    (k) => !(k === "hint" && hasVoted && results.hint == null),
  );

  return (
    <div className="powerups">
      <div className="powerups-head">{hasVoted ? "Analyze this image" : "Use a reward before you guess"}</div>
      <div className="powerup-btns">
        {kinds.map((kind) => {
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
              title={canUse ? "" : `Earn one every ${m.every} correct in a row`}
            >
              {busy === kind ? "…" : `${m.emoji} ${m.name}`}
              {unlockedHere ? " ✓" : canUse ? ` (${count})` : ` 🔒 every ${m.every}🔥`}
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
        💡 Hints reveal a clue (spend one <strong>before</strong> you guess). 🔍 Scans &amp; 🤖 Verdicts run an AI on the image.
        Rewards stack in your balance and persist — earn more by extending your streak. <Link href="/rewards">How it works →</Link>
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
