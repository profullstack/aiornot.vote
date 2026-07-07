import Link from "next/link";
import { requireAdminPage } from "@/lib/admin";
import { countActiveRecipients } from "@/lib/newsletter";
import { NewsletterComposer } from "@/components/NewsletterComposer";

export const metadata = { title: "Admin · Newsletter" };
export const dynamic = "force-dynamic";

export default async function AdminNewsletter() {
  await requireAdminPage();
  const recipients = await countActiveRecipients();
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Newsletter</h2>
        <span className="sub"><Link href="/admin">← Admin</Link></span>
      </div>
      <p className="muted-sm">
        Write a prompt, let AI draft the email, edit it, then blast it to all{" "}
        <strong>{recipients}</strong> active verified users via Resend.
      </p>
      <div className="form-card" style={{ marginTop: 10 }}>
        <NewsletterComposer />
      </div>
    </div>
  );
}
