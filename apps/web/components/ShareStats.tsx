"use client";
import { useState } from "react";

/**
 * Share a player's stats to X / Bluesky / Facebook, with a native-share and
 * copy-link fallback. `url` should be the public profile URL (rich OG card);
 * `text` is the pre-built blurb.
 */
export function ShareStats({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const enc = encodeURIComponent;

  const targets = [
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, bg: "#000", fg: "#fff" },
    { key: "bsky", label: "Bluesky", href: `https://bsky.app/intent/compose?text=${enc(`${text} ${url}`)}`, bg: "#1185fe", fg: "#fff" },
    { key: "fb", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, bg: "#1877f2", fg: "#fff" },
  ];

  const glyph: Record<string, string> = { x: "𝕏", bsky: "🦋", fb: "f" };

  function openPopup(href: string) {
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=520");
  }

  async function nativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "AIorNot.vote", text, url });
      } catch {
        /* user cancelled */
      }
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {targets.map((t) => (
        <button
          key={t.key}
          onClick={() => openPopup(t.href)}
          className="btn btn-sm"
          style={{ background: t.bg, color: t.fg, borderColor: t.bg, display: "inline-flex", gap: 6, alignItems: "center" }}
          aria-label={`Share on ${t.label}`}
        >
          <span aria-hidden style={{ fontWeight: 700 }}>{glyph[t.key]}</span> {t.label}
        </button>
      ))}
      {hasNativeShare && (
        <button className="btn btn-sm" onClick={nativeShare} aria-label="Share…">↗ Share</button>
      )}
      <button className="btn btn-sm" onClick={copy} aria-label="Copy link">
        {copied ? "✓ Copied" : "🔗 Copy link"}
      </button>
    </div>
  );
}
