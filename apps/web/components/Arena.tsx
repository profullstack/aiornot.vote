"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Magnifier } from "./Magnifier";

type PlayItem = {
  id: string;
  slug: string;
  title: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
};

type Reveal = {
  truth: "ai" | "not_ai";
  correct: boolean;
  aiPct: number;
  total: number;
} | null;

export function Arena({ signedIn }: { signedIn: boolean }) {
  const [queue, setQueue] = useState<PlayItem[]>([]);
  const [i, setI] = useState(0);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hints, setHints] = useState(0);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [earned, setEarned] = useState<{ emoji: string; label: string } | null>(null);
  const [showNag, setShowNag] = useState(false);
  const nagRef = useRef<HTMLDialogElement>(null);

  // Drive the native <dialog> as a blocking modal the guest must dismiss.
  useEffect(() => {
    const d = nagRef.current;
    if (!d) return;
    if (showNag && !d.open) d.showModal();
    else if (!showNag && d.open) d.close();
  }, [showNag]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/play/queue");
      const data = await res.json();
      setQueue(data.items || []);
      setHints(data.balances?.hints ?? 0);
      setI(0);
    } catch {
      setQueue([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = queue[i];

  async function vote(g: "ai" | "not_ai") {
    if (!current || busy || reveal) return;
    setBusy(true);
    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: current.id, guess: g }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return;
      const correct = !!data.isCorrect;
      setReveal({ truth: data.truthLabel, correct, aiPct: data.stats.aiPct, total: data.stats.total });
      if (data.earned) setEarned({ emoji: data.earned.emoji, label: data.earned.label });
      if (correct) {
        setScore((s) => s + 1);
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
      // Guest hit another multiple of N rounds — pop the dismissible join nag.
      if (data.nag) setShowNag(true);
    } catch {
      // Network error: just re-enable the buttons so the user can try again.
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setReveal(null);
    setHintText(null);
    setEarned(null);
    setRound((r) => r + 1);
    if (i + 1 >= queue.length) load();
    else setI((n) => n + 1);
  }

  async function useHint() {
    if (!current || hintBusy || reveal || hints <= 0) return;
    setHintBusy(true);
    try {
      const res = await fetch("/api/rewards/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: current.id, kind: "hint" }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setHintText(data.text);
        setHints(data.balances.hints);
      }
    } finally {
      setHintBusy(false);
    }
  }

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div>
      <div className="site-header" style={{ borderTop: "1px solid var(--border-1)" }}>
        <div className="muted-sm">Play mode — one photo at a time</div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted-2)" }}>
          <div>Round <b className="uh" style={{ color: "var(--text)" }}>{pad(round)}</b></div>
          <div>Score <b className="uh" style={{ color: "var(--human)" }}>{pad(score)}</b></div>
          <div>Streak <b className="uh" style={{ color: "var(--ai)" }}>{pad(streak)}</b></div>
        </div>
      </div>

      <div className="hero" style={{ padding: "28px 24px 4px" }}>
        <h1 style={{ fontSize: "clamp(22px,3vw,34px)" }}>Is it AI, or not?</h1>
        <p>Call it. No takebacks.</p>
      </div>

      {!signedIn && (
        <div className="muted-sm" style={{ textAlign: "center", padding: "0 24px" }}>
          🎮 Playing as guest · <Link href="/signup">Join free</Link> to save your streak & rank.
        </div>
      )}

      <div style={{ maxWidth: 460, margin: "0 auto", padding: "12px 24px 40px" }}>
        {loading ? (
          <div className="empty">Loading…</div>
        ) : !current ? (
          <div className="empty">
            You&apos;ve guessed everything available. <Link href="/">Browse the feed →</Link>
          </div>
        ) : (
          <div className="arena-card">
            <div className="arena-photo">
              {current.mediaType === "video" ? (
                <video src={current.mediaUrl} poster={current.posterUrl || undefined} muted playsInline />
              ) : (
                <Magnifier key={current.id} src={current.mediaUrl} alt={current.title} fit="cover" fill zoom={2.8} lensSize={190} />
              )}
              {reveal && (
                <div className="arena-overlay">
                  <div className="arena-truth" style={{ color: reveal.truth === "ai" ? "var(--ai)" : "var(--human)" }}>
                    {reveal.truth === "ai" ? "AI" : "NOT AI"}
                  </div>
                  <div className={`reveal-verdict ${reveal.correct ? "correct" : "wrong"}`}>
                    {reveal.correct ? "You called it" : "Fooled you"}
                  </div>
                  <div style={{ width: "60%" }}>
                    <div className="crowd-bar"><span style={{ width: `${reveal.aiPct}%` }} /></div>
                    <div className="crowd-caption" style={{ textAlign: "center" }}>{reveal.aiPct}% of voters said AI</div>
                  </div>
                </div>
              )}
            </div>
            {!reveal && (
              hintText ? (
                <div className="powerup-result" style={{ margin: 0 }}>
                  <div className="powerup-result-h">💡 Hint</div>
                  <div className="powerup-result-b">{hintText}</div>
                </div>
              ) : hints > 0 ? (
                <button className="powerup-btn ready" style={{ alignSelf: "center" }} disabled={hintBusy} onClick={useHint}>
                  {hintBusy ? "…" : `💡 Use a hint (${hints})`}
                </button>
              ) : null
            )}
            <div className="vote-row">
              <button className="vote-btn ai" disabled={busy || !!reveal} onClick={() => vote("ai")}>AI</button>
              <button className="vote-btn human" disabled={busy || !!reveal} onClick={() => vote("not_ai")}>NOT AI</button>
            </div>
            {reveal && earned && (
              <div className="earned-toast" style={{ fontSize: 13 }}>
                {earned.emoji} {earned.label} — saved to your rewards!
              </div>
            )}
            <div style={{ textAlign: "center", minHeight: 56 }}>
              {reveal ? (
                <button className="btn btn-pill btn-primary" onClick={next} style={{ animation: "popIn 0.35s ease both" }}>
                  NEXT →
                </button>
              ) : (
                <div className="muted-sm" style={{ letterSpacing: "0.14em", textTransform: "uppercase" }}>Trust your eyes</div>
              )}
            </div>
          </div>
        )}
      </div>

      <dialog
        ref={nagRef}
        className="nag-dialog"
        onCancel={(e) => e.preventDefault()}
        onClose={() => setShowNag(false)}
      >
        <h2 style={{ marginTop: 0 }}>Enjoying it? 🎉</h2>
        <p className="muted">
          You&apos;re playing as a guest. Create a <strong>free account</strong> to save your streak,
          climb the leaderboard, earn power-ups — and lose these interruptions.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
          <Link href="/signup" className="btn btn-primary btn-pill">Create free account</Link>
          <Link href="/login" className="btn btn-pill">Sign in</Link>
        </div>
        <button
          className="btn btn-pill"
          style={{ marginTop: 12, background: "transparent", color: "var(--muted-2)" }}
          onClick={() => setShowNag(false)}
        >
          Keep playing as guest →
        </button>
      </dialog>
    </div>
  );
}
