import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { listCodes } from "@/lib/credits";
import { AdminCreditsManager } from "@/components/CreditUI";

export const metadata = { title: "Admin · Credit codes" };
export const dynamic = "force-dynamic";

export default async function AdminCredits() {
  await requireAdminPage();
  const codes = await listCodes();
  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Credit codes</h2>
        <span className="sub"><Link href="/admin/promos">Promo codes →</Link></span>
      </div>
      <p className="muted-sm">
        A credit code adds <strong>days of the photo library pass</strong> (the same pass the $9 / 30-day checkout
        sells) to whoever redeems it under &quot;Have a code?&quot; on their account page. Codes are scarce and personal:
        one use each by default, stored only as a hash, so copy the code when it is shown. Promo codes (discounts at
        checkout) are separate.
      </p>
      <AdminCreditsManager initial={codes} />
    </div>
  );
}
