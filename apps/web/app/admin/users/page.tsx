import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { AdminUserRow } from "@/components/AdminControls";

export const metadata = { title: "Admin · Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsers() {
  await requireAdminPage();
  const res = await sqlClient.execute(
    "SELECT id, email, role, status FROM users ORDER BY created_at DESC LIMIT 200",
  );
  const users = res.rows.map((r) => ({
    id: r.id as string,
    email: r.email as string,
    role: r.role as string,
    status: r.status as string,
  }));
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head"><h2>Users</h2><span className="sub">{users.length}</span></div>
      <table className="lb-table">
        <thead><tr><th>Email</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>{users.map((u) => <AdminUserRow key={u.id} user={u} />)}</tbody>
      </table>
    </div>
  );
}
