"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "./CopyButton";

const COINS = ["SOL", "POL", "ETH", "BTC", "USDC_ETH", "USDC_POL", "DOGE", "BCH", "BNB", "ADA"];

export function SponsorForm({ minUsd, loggedIn }: { minUsd: number; loggedIn: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!loggedIn) {
    return (
      <div className="notice">
        <Link href="/login">Sign in</Link> to sponsor a weekly prize.
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/sponsor/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sponsorName: fd.get("sponsorName"),
        sponsorUrl: fd.get("sponsorUrl"),
        prizeLabel: fd.get("prizeLabel"),
        message: fd.get("message"),
        amountUsd: Number(fd.get("amountUsd")),
        blockchain: fd.get("blockchain"),
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setBusy(false);
      setErr(data.error || "Could not start checkout.");
      return;
    }
    router.push(`/sponsor/checkout/${data.sponsorshipId}`);
  }

  return (
    <form onSubmit={onSubmit} className="form-card" style={{ margin: "12px 0" }}>
      <div className="field">
        <label htmlFor="sponsorName">Sponsor name *</label>
        <input id="sponsorName" name="sponsorName" required maxLength={60} placeholder="Your name or brand" />
      </div>
      <div className="field">
        <label htmlFor="sponsorUrl">Link (optional)</label>
        <input id="sponsorUrl" name="sponsorUrl" type="url" placeholder="https://your-site.com" />
      </div>
      <div className="field">
        <label htmlFor="prizeLabel">Prize you&apos;re offering *</label>
        <input id="prizeLabel" name="prizeLabel" required maxLength={120} placeholder="e.g. $50 gift card, 1-year Pro plan, …" />
      </div>
      <div className="field">
        <label htmlFor="message">Short message (optional)</label>
        <input id="message" name="message" maxLength={200} placeholder="Shown with your shout-out" />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="amountUsd">Sponsorship (USD, min ${minUsd})</label>
          <input id="amountUsd" name="amountUsd" type="number" min={minUsd} step="1" defaultValue={minUsd} required />
        </div>
        <div className="field" style={{ minWidth: 140 }}>
          <label htmlFor="blockchain">Pay with</label>
          <select id="blockchain" name="blockchain" defaultValue="SOL">
            {COINS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
          </select>
        </div>
      </div>
      {err && <div className="form-error">{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Starting…" : "Sponsor this week →"}
      </button>
    </form>
  );
}

export function SponsorCheckoutPoller({
  id,
  amountUsd,
  blockchain,
  address,
  cryptoAmount,
  prizeLabel,
}: {
  id: string;
  amountUsd: number;
  blockchain: string;
  address: string;
  cryptoAmount: string;
  prizeLabel: string;
}) {
  const [status, setStatus] = useState("pending");
  useEffect(() => {
    if (status === "active") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/sponsor/status?id=${id}`);
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status);
        if (data.status === "active") clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [id, status]);

  if (status === "active") {
    return (
      <div className="form-card container-narrow">
        <h1>Sponsorship confirmed ✓</h1>
        <div className="form-ok">Thank you! Your prize — <strong>{prizeLabel}</strong> — is now part of this week&apos;s pack, with your shout-out on the prizes page.</div>
        <p style={{ marginTop: 16 }}><Link href="/prizes" className="btn btn-primary">See the prizes →</Link></p>
      </div>
    );
  }
  return (
    <div className="form-card container-narrow">
      <h1>Send ${amountUsd} in {blockchain.replace("_", " ")}</h1>
      <p className="muted">Send exactly this amount to the address below. This page updates automatically once it confirms on-chain.</p>
      <div className="field">
        <label>Amount</label>
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
      <div className="notice"><span className="rss-title">Waiting for payment…</span><div className="muted-sm">Status: {status}. Keep this tab open.</div></div>
    </div>
  );
}
