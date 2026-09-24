import { NextResponse } from "next/server";
import { vapidKeysFromEnv } from "@profullstack/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public VAPID key, legacy shape. New clients fetch /api/push/vapid-public-key;
 * this stays for pages loaded before that switch.
 */
export function GET() {
  const keys = vapidKeysFromEnv(process.env);
  return NextResponse.json({
    ok: true,
    configured: !!keys,
    publicKey: keys?.publicKey ?? null,
  });
}
