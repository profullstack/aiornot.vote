"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function PromoForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMsg({ ok: true, text: data.granted === "membership" ? "Unlocked — you're a lifetime member! 💛" : "Unlocked — you can play now! 🎉" });
        setCode("");
        setTimeout(() => router.refresh(), 900);
      } else {
        setMsg({ ok: false, text: data.error || "Could not redeem that code." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="PROMO CODE"
        aria-label="Promo code"
        style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", letterSpacing: "0.08em", textTransform: "uppercase" }}
      />
      <button className="btn" disabled={busy || !code.trim()}>{busy ? "Redeeming…" : "Redeem"}</button>
      {msg && <span className={msg.ok ? "form-ok" : "form-error"}>{msg.text}</span>}
    </form>
  );
}
