import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { AdminSeedControls } from "@/components/AdminControls";

export const metadata = { title: "Admin · Seed" };
export const dynamic = "force-dynamic";

export default async function AdminSeedBatches() {
  await requireAdminPage();
  const res = await sqlClient.execute(
    "SELECT id, name, source, category, status, total_imported, total_generated, created_at FROM seed_batches ORDER BY created_at DESC LIMIT 100",
  );
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head"><h2>Seed batches</h2></div>
      <AdminSeedControls />
      {res.rows.length === 0 ? (
        <div className="empty">No seed batches yet.</div>
      ) : (
        <table className="lb-table">
          <thead><tr><th>Name</th><th>Source</th><th>Status</th><th>Imported</th><th>Generated</th><th>When</th></tr></thead>
          <tbody>
            {res.rows.map((r) => (
              <tr key={r.id as string}>
                <td className="lb-name">{r.name as string}</td>
                <td>{r.source as string}</td>
                <td>{r.status as string}</td>
                <td>{Number(r.total_imported)}</td>
                <td>{Number(r.total_generated)}</td>
                <td className="muted-sm">{new Date((r.created_at as string) + "Z").toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
