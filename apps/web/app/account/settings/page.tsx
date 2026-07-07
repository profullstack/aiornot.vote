import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton, ResendVerification } from "@/components/AuthForms";

export const metadata = { title: "Account settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="form-card container-narrow">
      <h1>Settings</h1>
      <div className="field">
        <label>Email</label>
        <input value={user.email} readOnly />
      </div>
      <div className="field">
        <label>Display name</label>
        <input value={user.displayName || ""} readOnly placeholder="(not set)" />
      </div>
      <div className="field">
        <label>Status</label>
        <input value={`${user.status}${user.emailVerified ? " · verified" : " · unverified"}`} readOnly />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {!user.emailVerified && <ResendVerification />}
        <LogoutButton />
      </div>
    </div>
  );
}
