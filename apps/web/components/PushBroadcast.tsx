"use client";
import { useState } from "react";

export function PushBroadcast() {
  const [title, setTitle] = useState("New rounds are live 👀");
  const [body, setBody] = useState("Fresh AI-vs-real to guess. Can you keep your streak?");
  const [url, setUrl] = useState("/play");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) return;
    if (!confirm("Send this push to every subscribed user?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url }),
      }).then((r) => r.json());
      setMsg(res.ok ? `Sent to ${res.sent} device(s) · ${res.failed} failed · ${res.pruned} pruned.` : res.error);
    } catch {
      setMsg("Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="field">
        <label>Title</label>
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label>Body</label>
        <textarea value={body} maxLength={200} rows={2} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="field">
        <label>Link (opens on click)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/play" />
      </div>
      <button className="btn btn-primary" disabled={busy} onClick={send}>
        {busy ? "Sending…" : "Send push broadcast"}
      </button>
      {msg && <div className="muted-sm" style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}
