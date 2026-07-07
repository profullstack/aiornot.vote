import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserHistory } from "@/lib/queries";

export const metadata = { title: "Your guess history" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "correct", label: "Correct" },
  { key: "incorrect", label: "Incorrect" },
  { key: "pending", label: "Pending" },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string; tag?: string; media_type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const result = (sp.result as "correct" | "incorrect" | "pending" | undefined) || undefined;
  const rows = await getUserHistory(user.id, {
    result,
    tag: sp.tag,
    mediaType: sp.media_type,
  });

  return (
    <div className="container" style={{ padding: "32px 24px" }}>
      <div className="section-head">
        <h2>Your guess history</h2>
        <div className="tabs">
          {FILTERS.map((f) => {
            const href = f.key ? `/account/history?result=${f.key}` : "/account/history";
            const active = (result || "") === f.key;
            return (
              <Link key={f.label} href={href} className={active ? "active" : ""}>
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">No guesses yet. <Link href="/">Start guessing →</Link></div>
      ) : (
        <table className="lb-table">
          <thead>
            <tr>
              <th>Media</th>
              <th>Your guess</th>
              <th>Truth</th>
              <th>Result</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.mediaId}>
                <td>
                  <Link href={`/m/${r.slug}`} className="lb-name">
                    {r.title}
                  </Link>
                </td>
                <td>{r.guess === "ai" ? "AI" : "Not AI"}</td>
                <td>{r.truthLabel === "unknown" ? "—" : r.truthLabel === "ai" ? "AI" : "Not AI"}</td>
                <td>
                  {!r.isScored ? (
                    <span className="muted">Pending</span>
                  ) : r.isCorrect ? (
                    <span className="lb-correct">Correct</span>
                  ) : (
                    <span style={{ color: "var(--wrong)" }}>Incorrect</span>
                  )}
                </td>
                <td className="muted-sm">{new Date(r.createdAt + "Z").toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
