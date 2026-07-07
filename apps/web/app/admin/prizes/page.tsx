import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { AdminDrawPrizes } from "@/components/AdminControls";

export const metadata = { title: "Admin · Prizes" };
export const dynamic = "force-dynamic";

export default async function AdminPrizes() {
  await requireAdminPage();
  const res = await sqlClient.execute(
    `SELECT p.id, p.period_start, p.rank, p.reward_label, p.status, p.claimed_at,
            u.email
     FROM prizes p LEFT JOIN users u ON u.id = p.user_id
     ORDER BY p.period_start DESC, p.rank ASC LIMIT 100`,
  );
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Prizes</h2>
        <span className="sub"><Link href="/prizes">Public prizes page →</Link></span>
      </div>
      <div className="form-card" style={{ margin: "8px 0" }}>
        <h1 style={{ fontSize: 18 }}>Weekly draw</h1>
        <p className="muted-sm">Draws the most-recently-completed week (idempotent). Winners are emailed. Also runs via cron (<code>/api/cron/draw-prizes</code>).</p>
        <AdminDrawPrizes />
      </div>
      <p className="muted-sm"><strong>Claimed</strong> prizes need you to send the code to the winner&apos;s email.</p>
      <table className="lb-table">
        <thead><tr><th>Week</th><th>Rank</th><th>Reward</th><th>Winner</th><th>Status</th></tr></thead>
        <tbody>
          {res.rows.map((r) => (
            <tr key={r.id as string}>
              <td className="muted-sm">{new Date((r.period_start as string)).toLocaleDateString()}</td>
              <td className="lb-rank">{Number(r.rank)}</td>
              <td>{r.reward_label as string}</td>
              <td className="muted-sm">{(r.email as string) || "—"}</td>
              <td style={{ color: r.status === "claimed" ? "var(--ai)" : undefined }}>{r.status as string}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
