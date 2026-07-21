import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { listPromoCodes, setPromoActive } from "@/lib/entitlements";
import { normalizePromoMaxUses, normalizePromoPercentOff } from "@/lib/promo-form";

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
  const percentOff = normalizePromoPercentOff(formData.get("percent_off"));
  const appliesTo = ["any", "play_pass", "lifetime_membership"].includes(String(formData.get("applies_to")))
    ? String(formData.get("applies_to"))
    : "any";
  const maxUses = normalizePromoMaxUses(formData.get("max_uses"));
  if (code) {
    await sqlClient.execute({
      sql: "INSERT OR IGNORE INTO promo_codes (code, grants, percent_off, applies_to, active, max_uses, note) VALUES (?, 'membership', ?, ?, 1, ?, ?)",
      args: [code, percentOff, appliesTo, maxUses, "Created in admin"],
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
        Codes are <strong>percentage discounts</strong> applied at checkout. <code>100%</code> = free comp
        (granted instantly, no payment); anything less charges the discounted price in crypto. Scale the
        percentage down as you grow. <strong>Applies to</strong> limits which product a code discounts
        (<code>any</code>, play pass, or membership). Toggle a code off to disable it.
      </p>

      <table className="lb-table" style={{ marginTop: 8 }}>
        <thead><tr><th>Code</th><th>% off</th><th>Applies to</th><th>Uses</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {codes.map((c) => (
            <tr key={c.code}>
              <td><code>{c.code}</code></td>
              <td className="lb-correct">{c.percentOff}%</td>
              <td className="muted-sm">{c.appliesTo}</td>
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
          {codes.length === 0 && <tr><td colSpan={6} className="muted-sm">No codes yet.</td></tr>}
        </tbody>
      </table>

      <div className="form-card" style={{ marginTop: 18, maxWidth: 480 }}>
        <div className="rss-title">Create a code</div>
        <form action={createAction} style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <input name="code" placeholder="CODE (e.g. SUMMER25)" required
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", textTransform: "uppercase", letterSpacing: "0.08em" }} />
          <label className="muted-sm">Percent off (1–100; 100 = free comp)</label>
          <input name="percent_off" type="number" min={1} max={100} defaultValue={50} required
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }} />
          <label className="muted-sm">Applies to</label>
          <select name="applies_to" defaultValue="any"
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }}>
            <option value="any">any purchase</option>
            <option value="play_pass">play pass only</option>
            <option value="lifetime_membership">membership only</option>
          </select>
          <input name="max_uses" type="number" min={1} placeholder="Max uses (blank = unlimited)"
            style={{ background: "var(--panel-alt)", border: "1px solid var(--border-3)", borderRadius: 10, padding: "10px 12px", color: "var(--text)" }} />
          <button className="btn btn-primary">Create code</button>
        </form>
      </div>
    </div>
  );
}
