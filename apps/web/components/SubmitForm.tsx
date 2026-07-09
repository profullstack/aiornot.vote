"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SubmitForm({ canSubmit }: { canSubmit: boolean }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/submit", { method: "POST", body: new FormData(e.currentTarget) });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not submit.");
        return;
      }
      setOk(true);
      (e.target as HTMLFormElement).reset();
      setTimeout(() => router.push("/account"), 1200);
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="title">Title *</label>
        <input id="title" name="title" required placeholder="What are we looking at?" />
      </div>
      <div className="field">
        <label htmlFor="mediaUrl">External media URL</label>
        <input id="mediaUrl" name="mediaUrl" type="url" placeholder="https://…/image.jpg (or upload a file below)" />
      </div>
      <div className="field">
        <label htmlFor="file">Or upload a file (image or short video)</label>
        <input id="file" name="file" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" />
      </div>
      <div className="field">
        <label htmlFor="sourceUrl">Source URL (optional)</label>
        <input id="sourceUrl" name="sourceUrl" type="url" placeholder="Where did this come from?" />
      </div>
      <div className="field">
        <label htmlFor="tags">Suggested tags (comma-separated)</label>
        <input id="tags" name="tags" placeholder="portrait, uncanny, photorealistic" />
      </div>
      <div className="field">
        <label htmlFor="claim">Your call: is it AI?</label>
        <select id="claim" name="claim" defaultValue="unknown">
          <option value="unknown">Unsure</option>
          <option value="ai">AI-generated</option>
          <option value="not_ai">Real (not AI)</option>
        </select>
      </div>
      {err && <div className="form-error">{err}</div>}
      {ok && <div className="form-ok">Submitted for review — thanks! Redirecting…</div>}
      <button className="btn btn-primary" type="submit" disabled={busy || !canSubmit}>
        {busy ? "Submitting…" : "Submit for review"}
      </button>
      {!canSubmit && (
        <div className="notice warn">
          🎮 A one-time submit pass or lifetime membership is required to submit. <Link href="/membership">Get access →</Link>
        </div>
      )}
    </form>
  );
}
