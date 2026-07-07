"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ClaimButton({ prizeId, rewardLabel }: { prizeId: string; rewardLabel: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "claimed" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function claim() {
    setState("busy");
    const res = await fetch(`/api/prizes/${prizeId}/claim`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setState("error");
      setMsg(data.error || "Could not claim.");
      return;
    }
    setState("claimed");
    router.refresh();
  }

  if (state === "claimed") {
    return <span className="form-ok">Claimed! We&apos;ll email your code shortly. 🎉</span>;
  }
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn btn-primary btn-sm" onClick={claim} disabled={state === "busy"}>
        {state === "busy" ? "Claiming…" : `Claim: ${rewardLabel}`}
      </button>
      {msg && <span className="form-error">{msg}</span>}
    </span>
  );
}

export function WinBanner({
  prizes,
}: {
  prizes: Array<{ id: string; rewardLabel: string; claimDeadline: string }>;
}) {
  if (prizes.length === 0) return null;
  return (
    <div className="win-banner">
      <div className="container" style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span className="win-emoji">🏆</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong>You won a weekly prize!</strong>{" "}
          <span className="muted-sm">
            Claim by {new Date(prizes[0]!.claimDeadline).toLocaleDateString()} or it rolls into a future pack.
          </span>
        </div>
        <Link href="/prizes" className="btn btn-sm btn-primary">Claim now →</Link>
      </div>
    </div>
  );
}
