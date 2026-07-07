"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClientCard } from "./MediaCard";

export function DetailVote({
  card,
  canGuess,
  isLoggedIn,
  revealContent,
}: {
  card: ClientCard;
  canGuess: boolean;
  isLoggedIn: boolean;
  revealContent?: React.ReactNode;
}) {
  const router = useRouter();
  const [guess, setGuess] = useState<"ai" | "not_ai" | null>(card.userGuess);
  const [correct, setCorrect] = useState<boolean | null>(card.userGuessCorrect);
  const [truth, setTruth] = useState<"ai" | "not_ai" | "unknown">(
    card.userGuess ? card.truthLabel : "unknown",
  );
  const [stats, setStats] = useState(card.stats);
  const [earned, setEarned] = useState<{ emoji: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsPass, setNeedsPass] = useState(false);
  const revealed = guess != null;

  async function cast(g: "ai" | "not_ai") {
    if (!canGuess || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: card.id, guess: g }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setNeedsPass(true);
        return;
      }
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not save your guess.");
        return;
      }
      setGuess(g);
      setCorrect(data.isCorrect);
      setTruth(data.revealTruth ? data.truthLabel : "unknown");
      setStats((s) => ({ ...s, ...data.stats }));
      if (data.earned) setEarned({ emoji: data.earned.emoji, label: data.earned.label });
      router.refresh();
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {isLoggedIn && canGuess ? (
        <>
          <p className="muted-sm">Your call — one vote, no takebacks:</p>
          <div className="vote-row" style={{ maxWidth: 360 }}>
            <button
              className={`vote-btn ai ${guess === "ai" ? "picked-ai" : revealed ? "dim" : ""}`}
              disabled={busy || revealed}
              onClick={() => cast("ai")}
            >
              AI
            </button>
            <button
              className={`vote-btn human ${guess === "not_ai" ? "picked-human" : revealed ? "dim" : ""}`}
              disabled={busy || revealed}
              onClick={() => cast("not_ai")}
            >
              NOT AI
            </button>
          </div>
          {revealed && (
            <p className="muted-sm" style={{ marginTop: 8 }}>
              You&apos;ve locked in your vote on this one.
            </p>
          )}
        </>
      ) : isLoggedIn ? (
        <div className="notice">Verify your email on your <Link href="/account">account</Link> to guess.</div>
      ) : (
        <div className="notice">
          <Link href="/login">Sign in</Link> or <Link href="/signup">create an account</Link> to guess AI or Not AI.
        </div>
      )}

      {err && <div className="form-error">{err}</div>}
      {needsPass && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          🎮 A one-time <strong>${1}</strong> play pass is required to keep bots out.{" "}
          <Link href="/membership">Get access →</Link>
        </div>
      )}

      {revealed && (
        <div className="reveal" style={{ marginTop: 16 }}>
          {truth !== "unknown" && correct != null && (
            <div className={`reveal-verdict ${correct ? "correct" : "wrong"}`}>
              {correct ? "You called it" : "Fooled you"} · Truth: {truth === "ai" ? "AI" : "NOT AI"}
            </div>
          )}
          <div className="crowd-bar"><span style={{ width: `${stats.aiPct}%` }} /></div>
          <div className="crowd-caption">
            {stats.aiPct}% said AI · {100 - stats.aiPct}% said Not AI · {stats.totalGuesses}{" "}
            {stats.totalGuesses === 1 ? "vote" : "votes"}
          </div>
          {earned && (
            <div className="earned-toast">
              {earned.emoji} Milestone! {earned.label} — saved to your rewards. Spend it on your next image.
            </div>
          )}
          {revealContent && <div style={{ marginTop: 16 }}>{revealContent}</div>}
        </div>
      )}
    </div>
  );
}
