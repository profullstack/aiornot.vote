"use client";
import { useEffect, useState, useCallback } from "react";
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

export function Arena() {
  const [queue, setQueue] = useState<PlayItem[]>([]);
  const [i, setI] = useState(0);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/play/queue");
      const data = await res.json();
      setQueue(data.items || []);
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
      if (correct) {
        setScore((s) => s + 1);
        setStreak((s) => s + 1);
      } else {
        setStreak(0);
      }
    } catch {
      // Network error: just re-enable the buttons so the user can try again.
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setReveal(null);
    setRound((r) => r + 1);
    if (i + 1 >= queue.length) load();
    else setI((n) => n + 1);
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
            <div className="vote-row">
              <button className="vote-btn ai" disabled={busy || !!reveal} onClick={() => vote("ai")}>AI</button>
              <button className="vote-btn human" disabled={busy || !!reveal} onClick={() => vote("not_ai")}>NOT AI</button>
            </div>
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
    </div>
  );
}
