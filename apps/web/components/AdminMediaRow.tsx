"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export type AdminMedia = {
  id: string;
  slug: string;
  title: string;
  status: string;
  truthLabel: string;
  isFeatured: boolean;
  isScoreEligible: boolean;
  thumbnailUrl: string | null;
  mediaUrl: string;
  provider: string | null;
};

export function AdminMediaRow({ m }: { m: AdminMedia }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: string, body?: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/admin/media/${m.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <tr>
      <td>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={m.thumbnailUrl || m.mediaUrl}
          alt=""
          style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }}
        />
      </td>
      <td>
        <Link href={`/m/${m.slug}`} className="lb-name">{m.title}</Link>
        <div className="muted-sm">{m.provider} · {m.status}{m.isFeatured ? " · featured" : ""}{m.isScoreEligible ? "" : " · excluded"}</div>
      </td>
      <td>
        <select
          defaultValue={m.truthLabel}
          disabled={busy}
          onChange={(e) => act("set-truth-label", { truthLabel: e.target.value })}
        >
          <option value="unknown">unknown</option>
          <option value="ai">ai</option>
          <option value="not_ai">not_ai</option>
        </select>
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {m.status !== "approved" && <button className="btn btn-sm" disabled={busy} onClick={() => act("approve")}>Approve</button>}{" "}
        {m.status !== "rejected" && <button className="btn btn-sm" disabled={busy} onClick={() => act("reject")}>Reject</button>}{" "}
        <button className="btn btn-sm" disabled={busy} onClick={() => act(m.isFeatured ? "unfeature" : "feature")}>
          {m.isFeatured ? "Unfeature" : "Feature"}
        </button>{" "}
        <button className="btn btn-sm" disabled={busy} onClick={() => act(m.isScoreEligible ? "exclude-from-scoring" : "include-in-scoring")}>
          {m.isScoreEligible ? "Exclude" : "Include"}
        </button>{" "}
        <button className="btn btn-sm" disabled={busy} onClick={() => act("lock")}>Lock</button>
      </td>
    </tr>
  );
}
