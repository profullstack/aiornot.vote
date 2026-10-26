"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { INVITE_COOKIE } from "@/lib/invite-code";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "never");

/** "Have a code?" on /account: redeem a credit code for library pass days. */
export function RedeemCodeForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/credits/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: new FormData(form).get("code") }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setMsg({ ok: false, text: data.error || "That code did not work." });
        return;
      }
      const until = data.libraryPassUntil ? ` Your pass now runs to ${fmtDate(data.libraryPassUntil)}.` : "";
      setMsg({ ok: true, text: `Redeemed: ${data.days} day${data.days === 1 ? "" : "s"} of the photo library added.${until}` });
      form.reset();
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
      <label htmlFor="credit-code" className="sr-only">Code</label>
      <input
        id="credit-code"
        name="code"
        required
        maxLength={64}
        autoComplete="off"
        spellCheck={false}
        placeholder="CR-XXXX-XXXX-XXXX-XXXX"
        style={{ flex: "1 1 240px", minWidth: 0, padding: "10px 12px", borderRadius: 8, fontFamily: "monospace" }}
      />
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Redeeming…" : "Redeem"}
      </button>
      {msg && (
        <div className={msg.ok ? "form-ok" : "form-error"} style={{ flexBasis: "100%" }} role="status">
          {msg.text}
        </div>
      )}
    </form>
  );
}

type Invite = {
  id: string;
  code?: string;
  url?: string;
  note: string;
  status: "open" | "used" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  bonus?: "granted" | "none";
};

/** /invites: quota, make an invite (the link shows once), withdraw unused ones. */
export function InvitesManager({
  initial,
}: {
  initial: { quota: { total: number; used: number; left: number }; invites: Invite[]; bonusDays: number; canInvite: string | null };
}) {
  const [data, setData] = useState(initial);
  const [made, setMade] = useState<Invite | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/invites", { cache: "no-store" });
    const d = await res.json();
    if (d.ok) setData(d);
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: new FormData(form).get("note") }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setErr(d.error || "Could not make an invite.");
        return;
      }
      setMade(d.invite);
      form.reset();
      await reload();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setErr(null);
    const res = await fetch(`/api/invites/${encodeURIComponent(id)}/revoke`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.ok) setErr(d.error || "Could not withdraw that invite.");
    await reload();
  }

  return (
    <>
      <p className="muted">
        {data.quota.left} of {data.quota.total} invites left.
        {data.bonusDays > 0 && (
          <>
            {" "}When someone new joins on one and verifies their email, you both get{" "}
            <strong>{data.bonusDays} days of the photo library</strong>.
          </>
        )}
      </p>

      {made?.url && (
        <div className="form-ok" style={{ margin: "12px 0" }}>
          <div style={{ marginBottom: 8 }}>Your invite link. It is shown once, so copy it now:</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              readOnly
              value={made.url}
              onFocus={(e) => e.currentTarget.select()}
              style={{ flex: "1 1 260px", minWidth: 0, padding: "10px 12px", borderRadius: 8, fontFamily: "monospace" }}
            />
            <CopyButton text={made.url} label="Copy link" />
          </div>
        </div>
      )}

      {data.canInvite ? (
        <div className="notice warn">{data.canInvite}</div>
      ) : data.quota.left > 0 ? (
        <form onSubmit={create} style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
          <label htmlFor="invite-note" className="sr-only">Who is it for?</label>
          <input
            id="invite-note"
            name="note"
            maxLength={80}
            placeholder="Who is it for? (only you see this)"
            style={{ flex: "1 1 240px", minWidth: 0, padding: "10px 12px", borderRadius: 8 }}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Making…" : "Make an invite"}
          </button>
        </form>
      ) : null}
      {err && <div className="form-error">{err}</div>}

      {data.invites.length > 0 && (
        <table className="lb-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>For</th><th>Status</th><th>Made</th><th>Expires</th><th></th></tr>
          </thead>
          <tbody>
            {data.invites.map((i) => (
              <tr key={i.id}>
                <td>{i.note || <span className="muted-sm">(no note)</span>}</td>
                <td>
                  {i.status}
                  {i.status === "used" && i.bonus === "granted" && data.bonusDays > 0 ? ` · +${data.bonusDays} days` : ""}
                </td>
                <td className="muted-sm">{fmtDate(i.createdAt)}</td>
                <td className="muted-sm">{i.status === "open" ? fmtDate(i.expiresAt) : ""}</td>
                <td>
                  {i.status === "open" && (
                    <button type="button" className="btn btn-sm" onClick={() => revoke(i.id)}>Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** On /i/<code>: remember the invite through signup (the signup form also carries it). */
export function RememberInvite({ code }: { code: string }) {
  useEffect(() => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${INVITE_COOKIE}=${encodeURIComponent(code)}; Max-Age=${30 * 86400}; Path=/; SameSite=Lax${secure}`;
  }, [code]);
  return null;
}

type Code = {
  code?: string;
  id: string;
  label: string;
  days: number;
  maxRedemptions: number;
  redemptions: number;
  expiresAt: string | null;
  createdAt: string;
  revokedAt: string | null;
};

/** /admin/credits: mint library-day codes, list them, revoke. */
export function AdminCreditsManager({ initial }: { initial: Code[] }) {
  const [codes, setCodes] = useState(initial);
  const [made, setMade] = useState<Code | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    const d = await (await fetch("/api/admin/credits", { cache: "no-store" })).json();
    if (d.ok) setCodes(d.codes);
  }

  async function mint(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: Number(fd.get("days")),
          label: fd.get("label"),
          maxRedemptions: fd.get("max") ? Number(fd.get("max")) : undefined,
          expiresInDays: fd.get("expires") ? Number(fd.get("expires")) : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setErr(d.error || "Could not mint.");
        return;
      }
      setMade(d.code);
      form.reset();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Withdraw this code? Unredeemed uses stop working.")) return;
    await fetch(`/api/admin/credits/${encodeURIComponent(id)}/revoke`, { method: "POST" });
    await reload();
  }

  return (
    <>
      <form onSubmit={mint} className="form-card" style={{ margin: "12px 0", maxWidth: "none" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="field" style={{ flex: "0 0 120px" }}>
            <label htmlFor="days">Library days</label>
            <input id="days" name="days" type="number" min={1} max={3650} defaultValue={30} required />
          </div>
          <div className="field" style={{ flex: "1 1 220px" }}>
            <label htmlFor="label">Label (who it is for)</label>
            <input id="label" name="label" maxLength={120} placeholder="e.g. Preshy" />
          </div>
          <div className="field" style={{ flex: "0 0 120px" }}>
            <label htmlFor="max">Max uses</label>
            <input id="max" name="max" type="number" min={1} max={100000} placeholder="1" />
          </div>
          <div className="field" style={{ flex: "0 0 140px" }}>
            <label htmlFor="expires">Expires in (days)</label>
            <input id="expires" name="expires" type="number" min={1} max={3650} placeholder="never" />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Minting…" : "Mint code"}</button>
        {err && <div className="form-error">{err}</div>}
      </form>

      {made?.code && (
        <div className="form-ok" style={{ margin: "12px 0" }}>
          <div style={{ marginBottom: 8 }}>
            {made.days} days, {made.maxRedemptions} use{made.maxRedemptions === 1 ? "" : "s"}. Shown once; only its hash is stored:
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: 16 }}>{made.code}</code>
            <CopyButton text={made.code} label="Copy code" />
          </div>
        </div>
      )}

      <table className="lb-table">
        <thead>
          <tr><th>Label</th><th>Days</th><th>Used</th><th>Expires</th><th>Made</th><th></th></tr>
        </thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.id}>
              <td>{c.label}{c.revokedAt ? <span className="muted-sm"> (withdrawn)</span> : null}</td>
              <td>{c.days}</td>
              <td>{c.redemptions} / {c.maxRedemptions}</td>
              <td className="muted-sm">{fmtDate(c.expiresAt)}</td>
              <td className="muted-sm">{fmtDate(c.createdAt)}</td>
              <td>{!c.revokedAt && <button type="button" className="btn btn-sm" onClick={() => revoke(c.id)}>Revoke</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
