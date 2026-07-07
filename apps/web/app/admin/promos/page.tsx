import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { listPromoCodes, setPromoActive } from "@/lib/entitlements";

export const metadata = { title: "Admin · Promo codes" };
export const dynamic = "force-dynamic";

async function toggleAction(formData: FormData) {
  "use server";
  await requireAdminPage();
  const code = String(formData.get("code") || "");
  const active = String(formData.get("active") || "") === "1";
  await setPromoActive(code, active);
  revalidatePath("/admin/promos");
}

async function createAction(formData: FormData) {
  "use server";
  await requireAdminPage();
  const code = String(formData.get("code") || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  const grants = String(formData.get("grants") || "membership") === "play_pass" ? "play_pass" : "membership";
  const maxRaw = String(formData.get("max_uses") || "").trim();
  const maxUses = maxRaw ? Math.max(1, Number(maxRaw)) : null;
  if (code) {
    await sqlClient.execute({
      sql: "INSERT OR IGNORE INTO promo_codes (code, grants, active, max_uses, note) VALUES (?, ?, 1, ?, ?)",
      args: [code, grants, maxUses, "Created in admin"],
    });
  }
  revalidatePath("/admin/promos");
}

export default async function AdminPromos() {
  await requireAdminPage();
  const codes = await listPromoCodes();
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Promo codes</h2>
        <span className="sub"><Link href="/membership">Public access page →</Link></span>
      </div>
      <p className="muted-sm">
        Codes grant instant access without payment. Toggle <strong>100PERCENTOFF</strong> on when you
        want to hand out free access, off when you don&apos;t. <code>membership</code> = full lifetime
        (includes play + #nsfw); <code>play_pass</code> = play access only.
      </p>

      <table className="lb-table" style={{ marginTop: 8 }}>
        <thead><tr><th>Code</th><th>Grants</th><th>Uses</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.code}>
              <td><code>{c.code}</code></td>
              <td className="muted-sm">{c.grants}</td>
              <td className="muted-sm">{c.uses}{c.maxUses != null ? ` / ${c.maxUses}` : ""}</td>
              <td style={{ color: c.active ? "var(--human)" : "var(--muted-2)" }}>{c.active ? "ACTIVE" : "off"}</td>
              <td>
                <form action={toggleAction}>
                  <input type="hidden" name="code" value={c.code} />
                  <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                  <button className="btn" style={{ padding: "6px 12px" }}>{c.active ? "Turn off" : "Turn on"}</button>
                </form>
              </td>
            </tr>
          ))}
          {codes.length === 0 && <tr><td colSpan={5} className="muted-sm">No codes yet.</td></tr>}
        </tbody>
      </table>

      <div className="form-card" style={{ marginTop: 18, maxWidth: 480 }}>
        <div className="rss-title">Create a code</div>
        <form action={createAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input name="code" placeholder="CODE" required
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.08em" }} />
          <select name="grants" defaultValue="membership"
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }}>
            <option value="membership">membership (full lifetime)</option>
            <option value="play_pass">play_pass (play only)</option>
          </select>
          <input name="max_uses" type="number" min={1} placeholder="Max uses (blank = unlimited)"
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }} />
          <button className="btn btn-primary">Create code</button>
        </form>
      </div>
    </div>
  );
}
