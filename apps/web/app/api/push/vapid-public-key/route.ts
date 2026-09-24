import { vapidKeysFromEnv, vapidPublicKeyResponse } from "@profullstack/notifications/server";

export const runtime = "nodejs";
// Read the key per request: a value compiled in at build time is how push
// silently breaks when the build did not have it.
export const dynamic = "force-dynamic";

/** GET /api/push/vapid-public-key: { publicKey } (200), or 503 when push is not configured. */
export function GET() {
  return vapidPublicKeyResponse(vapidKeysFromEnv(process.env));
}
