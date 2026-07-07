"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminTagCreate() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="rss-bar"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const res = await fetch("/api/admin/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, isAnswerSpoiler: spoiler }),
        });
        const data = await res.json();
        setBusy(false);
        if (!res.ok || !data.ok) { setErr(data.error || "Failed."); return; }
        setName("");
        router.refresh();
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input placeholder="New tag name" value={name} onChange={(e) => setName(e.target.value)} required
          style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 8, padding: "8px 12px", color: "var(--text)" }} />
        <label className="muted-sm" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> answer spoiler
        </label>
      </div>
      <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Adding…" : "Add tag"}</button>
      {err && <span className="form-error">{err}</span>}
    </form>
  );
}

export function AdminUserRow({ user }: { user: { id: string; email: string; role: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }
  return (
    <tr>
      <td className="lb-name">{user.email}</td>
      <td>
        <select defaultValue={user.role} disabled={busy} onChange={(e) => patch({ role: e.target.value })}>
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
        </select>
      </td>
      <td>
        <select defaultValue={user.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })}>
          <option value="active">active</option>
          <option value="suspended">suspended</option>
          <option value="deleted">deleted</option>
        </select>
      </td>
    </tr>
  );
}

export function AdminSeedControls() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("portrait photography");
  const [count, setCount] = useState(10);

  async function run(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.ok ? `Done: ${JSON.stringify(data)}` : `Error: ${data.error}`);
    if (data.ok) router.refresh();
  }

  return (
    <div className="form-card" style={{ margin: "12px 0" }}>
      <h1 style={{ fontSize: 18 }}>Run seed jobs</h1>
      <p className="muted-sm">Requires UNSPLASH_ACCESS_KEY / OPENAI_API_KEY (and R2_* for AI variants). Larger batches: use the worker CLI.</p>
      <div className="field">
        <label>Unsplash query</label>
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="field">
        <label>Count (max 30 Unsplash / 10 AI)</label>
        <input type="number" value={count} min={1} max={30} onChange={(e) => setCount(Number(e.target.value))} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn" disabled={busy} onClick={() => run("/api/admin/seed/unsplash", { query, count })}>
          Import Unsplash
        </button>
        <button className="btn" disabled={busy} onClick={() => run("/api/admin/seed/generate-ai-variants", { count: Math.min(10, count) })}>
          Generate AI variants
        </button>
      </div>
      {msg && <div className="notice" style={{ marginTop: 12, wordBreak: "break-word" }}>{msg}</div>}
    </div>
  );
}
