import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { AdminMediaRow, type AdminMedia } from "@/components/AdminMediaRow";

export const metadata = { title: "Admin · Media" };
export const dynamic = "force-dynamic";

const STATUSES = ["all", "pending", "approved", "rejected", "hidden", "needs_review"];

export default async function AdminMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status || "") ? sp.status! : "all";
  const q = (sp.q || "").trim();

  const where: string[] = [];
  const args: unknown[] = [];
  if (status !== "all") { where.push("status = ?"); args.push(status); }
  if (q) { where.push("(LOWER(title) LIKE ? OR slug LIKE ?)"); args.push(`%${q.toLowerCase()}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await sqlClient.execute({
    sql: `SELECT id, slug, title, status, truth_label, is_featured, is_score_eligible,
                 thumbnail_url, media_url, source_provider
          FROM media ${whereSql} ORDER BY created_at DESC LIMIT 100`,
    args: args as never[],
  });
  const rows: AdminMedia[] = res.rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    title: r.title as string,
    status: r.status as string,
    truthLabel: r.truth_label as string,
    isFeatured: Number(r.is_featured) === 1,
    isScoreEligible: Number(r.is_score_eligible) === 1,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    mediaUrl: r.media_url as string,
    provider: (r.source_provider as string) ?? null,
  }));

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Media moderation</h2>
        <div className="tabs">
          {STATUSES.map((s) => (
            <Link key={s} href={`/admin/media?status=${s}`} className={s === status ? "active" : ""}>{s}</Link>
          ))}
        </div>
      </div>
      <form action="/admin/media" method="get" className="hero-search" style={{ maxWidth: 420, margin: "8px 0" }}>
        <input type="search" name="q" defaultValue={q} placeholder="Search title or slug…" />
        <input type="hidden" name="status" value={status} />
        <button className="btn btn-primary" type="submit">Search</button>
      </form>
      {rows.length === 0 ? (
        <div className="empty">No media match.</div>
      ) : (
        <table className="lb-table">
          <thead>
            <tr><th></th><th>Title</th><th>Truth</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => <AdminMediaRow key={m.id} m={m} />)}
          </tbody>
        </table>
      )}
    </div>
  );
}
