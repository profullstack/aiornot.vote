"use client";
import { useState } from "react";

export function NewsletterComposer() {
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [busy, setBusy] = useState<null | "gen" | "send">(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function generate() {
    if (!prompt.trim() || busy) return;
    setBusy("gen");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubject(data.subject);
        setHtml(data.html);
        setRecipients(data.recipients);
      } else {
        setMsg({ ok: false, text: data.error || "Generation failed." });
      }
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (!subject.trim() || !html.trim() || busy) return;
    if (!confirm(`Send "${subject}" to ${recipients ?? "all"} active users? This cannot be undone.`)) return;
    setBusy("send");
    setMsg(null);
    try {
      const res = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, html }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMsg({ ok: true, text: `Sent to ${data.sent} / ${data.total} users${data.failed ? ` (${data.failed} failed)` : ""}.` });
      } else {
        setMsg({ ok: false, text: data.error || "Send failed." });
      }
    } finally {
      setBusy(null);
    }
  }

  const field = { background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", width: "100%" } as const;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <label className="rss-title">Prompt for the AI</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="e.g. Announce that we now have tweet & video guessing games, and a $1 play pass. Nudge people to try to beat their streak."
          style={{ ...field, marginTop: 6, resize: "vertical" }}
        />
        <button className="btn btn-primary" onClick={generate} disabled={busy !== null || !prompt.trim()} style={{ marginTop: 8 }}>
          {busy === "gen" ? "Drafting…" : "✨ Generate with AI"}
        </button>
      </div>

      {(subject || html) && (
        <div style={{ display: "grid", gap: 12, borderTop: "1px solid var(--border-1)", paddingTop: 14 }}>
          <div>
            <label className="rss-title">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...field, marginTop: 6 }} />
          </div>
          <div>
            <label className="rss-title">Body (HTML — editable)</label>
            <textarea value={html} onChange={(e) => setHtml(e.target.value)} rows={10} style={{ ...field, marginTop: 6, fontFamily: "var(--mono, monospace)", fontSize: 13, resize: "vertical" }} />
          </div>
          <div>
            <label className="rss-title">Preview</label>
            <div style={{ ...field, marginTop: 6, minHeight: 80 }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={send} disabled={busy !== null}>
              {busy === "send" ? "Sending…" : `📣 Send to ${recipients ?? "all"} active users`}
            </button>
            {msg && <span className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</span>}
          </div>
        </div>
      )}
      {msg && !subject && <span className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</span>}
    </div>
  );
}
