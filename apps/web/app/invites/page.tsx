import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { myInvites } from "@/lib/credits";
import { InvitesManager } from "@/components/CreditUI";

export const metadata = { title: "Invites", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const initial = await myInvites(user.id);
  return (
    <div className="container-narrow" style={{ padding: "32px 24px" }}>
      <div className="section-head">
        <h2>Invites</h2>
        <Link href="/account" className="sub">← Your account</Link>
      </div>
      <p className="muted">
        Invites are scarce on purpose: a few per account, one person each, good for 30 days. Hand one to someone you
        want here. It works only for a new account, once its email is verified.
      </p>
      <InvitesManager initial={initial} />
      <p className="muted-sm" style={{ marginTop: 16 }}>
        Want to share widely instead? Your open <Link href="/refer">refer-a-friend link</Link> still earns its own reward.
        One sign-up counts once: on an invite or on a referral link, not both.
      </p>
    </div>
  );
}
