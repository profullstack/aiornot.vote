import Link from "next/link";
import { vapidKeysFromEnv } from "@profullstack/notifications/server";
import { requireAdminPage } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { PushBroadcast } from "@/components/PushBroadcast";

export const metadata = { title: "Admin · Notifications" };
export const dynamic = "force-dynamic";

export default async function AdminNotifications() {
  await requireAdminPage();
  const r = await sqlClient.execute(
    `SELECT COUNT(DISTINCT ps.user_id) users, COUNT(*) devices
     FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id
     WHERE u.status = 'active' AND u.notifications_enabled = 1`,
  );
  const users = Number(r.rows[0]?.users ?? 0);
  const devices = Number(r.rows[0]?.devices ?? 0);
  const configured = vapidKeysFromEnv(process.env) !== null;
  return (
    <div className="container-narrow" style={{ paddingTop: 24 }}>
      <div className="section-head">
        <h2>Push notifications</h2>
        <span className="sub"><Link href="/admin">← Admin</Link></span>
      </div>
      <p className="muted-sm">
        Blast a web-push to all subscribed users — <strong>{users}</strong> user(s) across{" "}
        <strong>{devices}</strong> device(s). Great for &quot;new rounds live&quot; or comeback nudges.
      </p>
      {!configured && (
        <div className="notice warn" style={{ marginTop: 10 }}>
          Push is not configured: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server. Broadcasts send nothing until then.
        </div>
      )}
      <div className="form-card" style={{ marginTop: 10 }}>
        <PushBroadcast />
      </div>
    </div>
  );
}
