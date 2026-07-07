import { requireAdminPage } from "@/lib/admin";
import { listTags } from "@/lib/queries";
import { AdminTagCreate } from "@/components/AdminControls";

export const metadata = { title: "Admin · Tags" };
export const dynamic = "force-dynamic";

export default async function AdminTags() {
  await requireAdminPage();
  const tags = await listTags();
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head"><h2>Tags</h2><span className="sub">{tags.length} tags</span></div>
      <AdminTagCreate />
      <table className="lb-table">
        <thead><tr><th>Slug</th><th>Name</th><th>Media</th><th>Default</th><th>Spoiler</th></tr></thead>
        <tbody>
          {tags.map((t) => (
            <tr key={t.slug}>
              <td className="lb-name">#{t.slug}</td>
              <td>{t.name}</td>
              <td>{t.mediaCount}</td>
              <td>{t.isDefault ? "yes" : "—"}</td>
              <td>{t.isAnswerSpoiler ? "yes" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
