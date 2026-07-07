import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";

export const metadata = { title: "Admin · Submissions" };
export const dynamic = "force-dynamic";

export default async function AdminSubmissions() {
  await requireAdminPage();
  const res = await sqlClient.execute(
    `SELECT s.id, s.title, s.media_type, s.submitter_claim, s.status, s.created_at, u.email
     FROM submissions s LEFT JOIN users u ON u.id = s.user_id
     ORDER BY s.created_at DESC LIMIT 100`,
  );
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Submissions queue</h2>
        <span className="sub"><Link href="/admin/media?status=pending">Moderate pending media →</Link></span>
      </div>
      <p className="muted-sm">Each submission also creates a pending media item — approve or reject it from the media moderation screen.</p>
      {res.rows.length === 0 ? (
        <div className="empty">No submissions yet.</div>
      ) : (
        <table className="lb-table">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Claim</th><th>By</th><th>Status</th><th>When</th></tr>
          </thead>
          <tbody>
            {res.rows.map((r) => (
              <tr key={r.id as string}>
                <td className="lb-name">{r.title as string}</td>
                <td>{r.media_type as string}</td>
                <td>{(r.submitter_claim as string) || "—"}</td>
                <td className="muted-sm">{(r.email as string) || "—"}</td>
                <td>{r.status as string}</td>
                <td className="muted-sm">{new Date((r.created_at as string) + "Z").toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
