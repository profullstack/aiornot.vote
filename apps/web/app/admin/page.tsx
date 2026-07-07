import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

async function count(sql: string): Promise<number> {
  const r = await sqlClient.execute(sql);
  return Number(r.rows[0]?.c ?? 0);
}

export default async function AdminHome() {
  await requireAdminPage();
  const [pending, approved, submissions, users, tags, batches] = await Promise.all([
    count("SELECT COUNT(*) c FROM media WHERE status='pending'"),
    count("SELECT COUNT(*) c FROM media WHERE status='approved'"),
    count("SELECT COUNT(*) c FROM submissions WHERE status='pending'"),
    count("SELECT COUNT(*) c FROM users"),
    count("SELECT COUNT(*) c FROM tags"),
    count("SELECT COUNT(*) c FROM seed_batches"),
  ]);

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head"><h2>Admin console</h2></div>
      <div className="stat-tiles">
        <Link href="/admin/media?status=pending" className="tile"><div className="val ai">{pending}</div><div className="lbl">Pending media</div></Link>
        <Link href="/admin/media" className="tile"><div className="val human">{approved}</div><div className="lbl">Approved media</div></Link>
        <Link href="/admin/submissions" className="tile"><div className="val">{submissions}</div><div className="lbl">Submissions</div></Link>
        <Link href="/admin/users" className="tile"><div className="val">{users}</div><div className="lbl">Users</div></Link>
        <Link href="/admin/tags" className="tile"><div className="val">{tags}</div><div className="lbl">Tags</div></Link>
        <Link href="/admin/seed-batches" className="tile"><div className="val">{batches}</div><div className="lbl">Seed batches</div></Link>
        <Link href="/admin/promos" className="tile"><div className="val">%</div><div className="lbl">Promo codes</div></Link>
        <Link href="/admin/newsletter" className="tile"><div className="val">✉️</div><div className="lbl">Newsletter</div></Link>
      </div>
      <div className="tabs" style={{ marginTop: 8 }}>
        <Link href="/admin/media" className="active">Media</Link>
        <Link href="/admin/submissions">Submissions</Link>
        <Link href="/admin/tags">Tags</Link>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/seed-batches">Seed</Link>
        <Link href="/admin/prizes">Prizes</Link>
        <Link href="/admin/promos">Promos</Link>
        <Link href="/admin/newsletter">Newsletter</Link>
      </div>
    </div>
  );
}
