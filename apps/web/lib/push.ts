import "server-only";
import { sendPush, vapidKeysFromEnv, type VapidKeys } from "@profullstack/notifications/server";
import { sqlClient } from "./db";
import { newId } from "@aiornot/db";
import { env } from "./env";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// VAPID keys, looked up at RUN time. Next replaces a literal
// `process.env.NAME` at build time, so a key missing from the build would
// compile in as empty and silently disable push; vapidKeysFromEnv reads the
// names dynamically (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
let vapidKeys: VapidKeys | null = null;
function ensureVapid(): VapidKeys | null {
  vapidKeys ??= vapidKeysFromEnv(process.env);
  return vapidKeys;
}

/** Store (or refresh) a browser push subscription for a user. Idempotent by endpoint. */
export async function saveSubscription(
  userId: string,
  sub: BrowserSubscription,
  userAgent: string | null,
): Promise<void> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    throw new Error("Invalid subscription.");
  }
  await sqlClient.execute({
    sql: `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            user_agent = excluded.user_agent`,
    args: [newId("push"), userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, userAgent?.slice(0, 300) ?? null],
  });
  await sqlClient.execute({
    sql: "UPDATE users SET notifications_enabled = 1 WHERE id = ?",
    args: [userId],
  });
}

/** Remove one subscription (this device) and, if it was the last, flip the pref off. */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await sqlClient.execute({
    sql: "DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?",
    args: [userId, endpoint],
  });
  const left = await sqlClient.execute({
    sql: "SELECT COUNT(*) c FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  if (Number(left.rows[0]?.c ?? 0) === 0) {
    await sqlClient.execute({
      sql: "UPDATE users SET notifications_enabled = 0 WHERE id = ?",
      args: [userId],
    });
  }
}

// web-push's default TTL (4 weeks), kept so delivery behaves as before.
const PUSH_TTL_SECONDS = 4 * 7 * 24 * 3600;

async function deliver(
  keys: VapidKeys,
  rows: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; pruned: number }> {
  const json = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let pruned = 0;
  const stale: string[] = [];

  const CONCURRENCY = 6;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    // sendPush never throws for a delivery failure; it reports it.
    const results = await Promise.all(
      chunk.map((r) =>
        sendPush({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, json, {
          keys,
          subject: env.vapid.subject,
          ttl: PUSH_TTL_SECONDS,
        }),
      ),
    );
    results.forEach((res, idx) => {
      if (res.sent) {
        sent++;
      } else {
        failed++;
        // 404/410 = subscription gone; prune so we stop retrying dead endpoints.
        if (res.gone) stale.push(chunk[idx].endpoint);
      }
    });
  }

  if (stale.length) {
    for (const endpoint of stale) {
      await sqlClient.execute({ sql: "DELETE FROM push_subscriptions WHERE endpoint = ?", args: [endpoint] });
      pruned++;
    }
  }
  return { sent, failed, pruned };
}

/** Send a push to every subscription belonging to one user (all their devices). */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const keys = ensureVapid();
  if (!keys) return { sent: 0, failed: 0, pruned: 0 };
  const res = await sqlClient.execute({
    sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  return deliver(keys, res.rows as never[], payload);
}

/** Broadcast a push to all subscriptions of users who haven't opted out. */
export async function broadcastPush(payload: PushPayload) {
  const keys = ensureVapid();
  if (!keys) return { sent: 0, failed: 0, pruned: 0 };
  const res = await sqlClient.execute(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.status = 'active' AND u.notifications_enabled = 1`,
  );
  return deliver(keys, res.rows as never[], payload);
}
