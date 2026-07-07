"use client";
import { useState } from "react";
import Link from "next/link";
import { Magnifier } from "./Magnifier";

export type ClientTag = { slug: string; name: string; isAnswerSpoiler: boolean };
export type ClientCard = {
  id: string;
  slug: string;
  title: string;
  mediaType: "image" | "video" | "link";
  mediaUrl: string;
  thumbnailUrl: string | null;
  posterUrl: string | null;
  body: string | null;
  sourceUrl: string | null;
  sourceProvider: string | null;
  isFeatured: boolean;
  truthLabel: "ai" | "not_ai" | "unknown";
  tags: ClientTag[];
  userGuess: "ai" | "not_ai" | null;
  userGuessCorrect: boolean | null;
  stats: { aiGuesses: number; notAiGuesses: number; totalGuesses: number; aiPct: number };
};

export function MediaCard({
  card,
  canGuess,
  isLoggedIn,
}: {
  card: ClientCard;
  canGuess: boolean;
  isLoggedIn: boolean;
}) {
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
  const poster = card.thumbnailUrl || card.posterUrl || card.mediaUrl;
  const visibleTags = card.tags.filter((t) => !t.isAnswerSpoiler);

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
      setStats((s) => ({ ...s, ...data.stats, aiPct: data.stats.aiPct }));
      if (data.earned) setEarned({ emoji: data.earned.emoji, label: data.earned.label });
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card">
      {card.mediaType === "link" ? (
        <div className="card-media card-post" style={{ display: "flex", alignItems: "center", padding: "18px 18px", background: "var(--panel-alt)" }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "var(--text)", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {card.body || card.title}
          </p>
          <span className="badge-type">{card.sourceProvider === "url" ? "post" : card.sourceProvider || "post"}</span>
          {card.isFeatured && <span className="badge-featured">Featured</span>}
        </div>
      ) : (
        <div className="card-media">
          {card.mediaType === "video" ? (
            <video src={card.mediaUrl} poster={card.posterUrl || undefined} muted playsInline preload="metadata" />
          ) : (
            <Magnifier src={poster} alt={card.title} fit="cover" fill zoom={2.4} lensSize={150} />
          )}
          <span className="badge-type">{card.mediaType}</span>
          {card.isFeatured && <span className="badge-featured">Featured</span>}
        </div>
      )}
      <div className="card-body">
        <h3 className="card-title">
          <Link href={`/m/${card.slug}`}>{card.title}</Link>
        </h3>
        {visibleTags.length > 0 && (
          <div className="card-tags">
            {visibleTags.map((t) => (
              <Link key={t.slug} href={`/t/${t.slug}`}>
                #{t.slug}
              </Link>
            ))}
          </div>
        )}

        {isLoggedIn && canGuess ? (
          <div className="vote-row">
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
        ) : isLoggedIn ? (
          <div className="signin-cta">
            <Link href="/account">Verify your email</Link> to guess.
          </div>
        ) : (
          <div className="signin-cta">
            <Link href="/login">Sign in</Link> to guess AI or Not AI.
          </div>
        )}

        {err && <div className="form-error">{err}</div>}
        {needsPass && (
          <div className="notice warn" style={{ marginTop: 8 }}>
            🎮 A one-time $1 play pass unlocks voting. <Link href="/membership">Get access →</Link>
          </div>
        )}

        {revealed && (
          <div className="reveal">
            {truth !== "unknown" && correct != null && (
              <div className={`reveal-verdict ${correct ? "correct" : "wrong"}`}>
                {correct ? "You called it" : "Fooled you"} · Truth:{" "}
                {truth === "ai" ? "AI" : "NOT AI"}
              </div>
            )}
            <div className="crowd-bar">
              <span style={{ width: `${stats.aiPct}%` }} />
            </div>
            <div className="crowd-caption">
              {stats.aiPct}% said AI · {100 - stats.aiPct}% said Not AI ·{" "}
              {stats.totalGuesses} {stats.totalGuesses === 1 ? "vote" : "votes"}
            </div>
            {earned && (
              <div className="earned-toast" style={{ fontSize: 13 }}>
                {earned.emoji} {earned.label} — saved to your rewards!
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
