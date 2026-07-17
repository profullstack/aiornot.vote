"use client";
import { useState } from "react";
import { CopyButton } from "@/components/CopyButton";

export function ShareLink({ link }: { link: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="field-inline"
        style={{ flex: "1 1 260px", minWidth: 0, padding: "10px 12px", borderRadius: 8 }}
      />
      <CopyButton text={link} label="Copy link" />
    </div>
  );
}

export function InviteForm({ rewardLabel }: { rewardLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const emails = String(fd.get("emails") || "");
    try {
      const res = await fetch("/api/referrals/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Could not send invites.");
        return;
      }
      const parts = [`${data.sent} invite${data.sent === 1 ? "" : "s"} sent`];
      if (data.skipped > 0) parts.push(`${data.skipped} skipped (already a member or invalid)`);
      setMsg(parts.join(" · ") + ".");
      (e.target as HTMLFormElement).reset();
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="emails">Invite by email</label>
        <textarea
          id="emails"
          name="emails"
          rows={3}
          required
          placeholder="friend@example.com, another@example.com&#10;one per line or comma-separated"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, resize: "vertical" }}
        />
      </div>
      {err && <div className="form-error">{err}</div>}
      {msg && <div className="form-ok">{msg}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send invites"}
      </button>
      <p className="muted-sm" style={{ marginTop: 8 }}>
        Each friend who joins and verifies their email earns you: <strong>{rewardLabel}</strong>.
      </p>
    </form>
  );
}
