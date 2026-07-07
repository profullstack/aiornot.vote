"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "./CopyButton";

const COINS = ["SOL", "POL", "ETH", "BTC", "USDC_ETH", "USDC_POL", "DOGE", "BCH", "BNB", "ADA"];

export function BuyButton({
  purpose,
  priceUsd,
  label,
}: {
  purpose: "api_access" | "lifetime_membership" | "play_pass";
  priceUsd: number;
  label: string;
}) {
  const router = useRouter();
  const [coin, setCoin] = useState("SOL");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/payments/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, blockchain: coin }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setBusy(false);
      setErr(data.error || "Could not start checkout.");
      return;
    }
    router.push(`/checkout/${data.paymentId}`);
  }

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <select value={coin} onChange={(e) => setCoin(e.target.value)} disabled={busy}
        style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }}>
        {COINS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
      </select>
      <button className="btn btn-primary" onClick={buy} disabled={busy}>
        {busy ? "Starting…" : `${label} — $${priceUsd} in crypto`}
      </button>
      {err && <span className="form-error">{err}</span>}
    </div>
  );
}

export function CheckoutPoller({
  paymentId,
  purpose,
  amountUsd,
  blockchain,
  address,
  cryptoAmount,
}: {
  paymentId: string;
  purpose: string;
  amountUsd: number;
  blockchain: string;
  address: string;
  cryptoAmount: string;
}) {
  const [status, setStatus] = useState("pending");
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (status === "granted") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/payments/status?id=${paymentId}`);
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status);
        if (data.apiKey) setApiKey(data.apiKey);
        if (data.status === "granted") clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [paymentId, status]);

  if (status === "granted") {
    return (
      <div className="form-card container-narrow">
        <h1>Payment confirmed ✓</h1>
        {purpose === "lifetime_membership" ? (
          <div className="form-ok">You&apos;re now a lifetime member. Enjoy your badge and free API keys.</div>
        ) : apiKey ? (
          <>
            <div className="form-ok">API access granted. Here&apos;s your API key — copy it now, it won&apos;t be shown again:</div>
            <div className="field">
              <input readOnly value={apiKey} style={{ fontFamily: "monospace" }} />
            </div>
            <CopyButton text={apiKey} label="Copy API key" />
          </>
        ) : (
          <div className="form-ok">API access granted. Manage your keys in your account.</div>
        )}
        <p style={{ marginTop: 16 }}>
          <Link href="/account" className="btn btn-primary">Go to account →</Link>
          {purpose === "api_access" && <> · <Link href="/api">API docs</Link></>}
        </p>
      </div>
    );
  }

  return (
    <div className="form-card container-narrow">
      <h1>Send ${amountUsd} in {blockchain.replace("_", " ")}</h1>
      <p className="muted">Send exactly this amount to the address below. This page updates automatically once the payment confirms on-chain.</p>
      <div className="field">
        <label>Amount ({blockchain.replace("_", " ")})</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly value={cryptoAmount} style={{ fontFamily: "monospace" }} />
          <CopyButton text={cryptoAmount} label="Copy" />
        </div>
      </div>
      <div className="field">
        <label>Payment address</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly value={address} style={{ fontFamily: "monospace" }} />
          <CopyButton text={address} label="Copy" />
        </div>
      </div>
      <div className="notice">
        <span className="rss-title">Waiting for payment…</span>
        <div className="muted-sm">Status: {status}. Keep this tab open — it can take a minute after you send.</div>
      </div>
    </div>
  );
}

export function ApiKeysManager({
  isMember,
  initialKeys,
}: {
  isMember: boolean;
  initialKeys: Array<{ id: string; prefix: string; label: string | null; requestCount: number; isActive: boolean }>;
}) {
  const [keys, setKeys] = useState(initialKeys);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await fetch("/api/account/api-keys");
    const data = await res.json();
    if (data.ok) setKeys(data.keys);
  }
  async function create() {
    setBusy(true);
    const res = await fetch("/api/account/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      setFresh(data.apiKey);
      refresh();
    }
  }
  async function revoke(id: string) {
    await fetch(`/api/account/api-keys?id=${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div>
      <div className="section-head">
        <h2 style={{ fontSize: 20 }}>API keys</h2>
        {isMember ? (
          <button className="btn btn-sm btn-primary" onClick={create} disabled={busy}>
            {busy ? "Creating…" : "+ New key"}
          </button>
        ) : (
          <Link href="/api" className="btn btn-sm">Get API access ($1)</Link>
        )}
      </div>
      {fresh && (
        <div className="notice warn">
          <div className="rss-title">New key — copy it now, it won&apos;t be shown again:</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input readOnly value={fresh} style={{ fontFamily: "monospace", flex: 1, background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 8, padding: "8px 10px", color: "var(--text)" }} />
            <CopyButton text={fresh} label="Copy" />
          </div>
        </div>
      )}
      {keys.length === 0 ? (
        <p className="muted-sm">No API keys yet.</p>
      ) : (
        <table className="lb-table">
          <thead><tr><th>Key</th><th>Label</th><th>Requests</th><th></th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td style={{ fontFamily: "monospace" }}>{k.prefix}…{!k.isActive && " (revoked)"}</td>
                <td>{k.label || "—"}</td>
                <td>{k.requestCount}</td>
                <td>{k.isActive && <button className="btn btn-sm" onClick={() => revoke(k.id)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
