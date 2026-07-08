import "server-only";
import webpush from "web-push";
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

let vapidReady = false;
function ensureVapid(): boolean {
  if (!env.pushConfigured) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
    vapidReady = true;
  }
  return true;
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

async function deliver(
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
    const results = await Promise.allSettled(
      chunk.map((r) =>
        webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          json,
        ),
      ),
    );
    results.forEach((res, idx) => {
      if (res.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        const code = (res.reason as { statusCode?: number })?.statusCode;
        // 404/410 = subscription gone; prune so we stop retrying dead endpoints.
        if (code === 404 || code === 410) stale.push(chunk[idx].endpoint);
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
  if (!ensureVapid()) return { sent: 0, failed: 0, pruned: 0 };
  const res = await sqlClient.execute({
    sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  });
  return deliver(res.rows as never[], payload);
}

/** Broadcast a push to all subscriptions of users who haven't opted out. */
export async function broadcastPush(payload: PushPayload) {
  if (!ensureVapid()) return { sent: 0, failed: 0, pruned: 0 };
  const res = await sqlClient.execute(
    `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.status = 'active' AND u.notifications_enabled = 1`,
  );
  return deliver(res.rows as never[], payload);
}
