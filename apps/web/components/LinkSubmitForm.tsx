"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function LinkSubmitForm({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsPass, setNeedsPass] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setNeedsPass(false);
    try {
      const res = await fetch("/api/submit/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setNeedsPass(true);
        return;
      }
      if (res.ok && data.ok) {
        router.push(`/m/${data.slug}`);
      } else {
        setErr(data.error || "Could not submit that link.");
      }
    } catch {
      setErr("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://x.com/…, reddit.com/…, bsky.app/…, any post URL"
        aria-label="Post URL"
        style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "12px 14px", color: "var(--text)" }}
      />
      <div>
        <button className="btn btn-primary" disabled={busy || !url.trim() || !canSubmit}>
          {busy ? "Fetching…" : "Submit for the crowd to judge"}
        </button>
      </div>
      {!canSubmit && (
        <div className="notice warn">🎮 A one-time submit pass or lifetime membership is required to submit. <Link href="/membership">Get access →</Link></div>
      )}
      {needsPass && (
        <div className="notice warn">🎮 A one-time submit pass or lifetime membership is required to submit. <Link href="/membership">Get access →</Link></div>
      )}
      {err && <div className="form-error">{err}</div>}
    </form>
  );
}
