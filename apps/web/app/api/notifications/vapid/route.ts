import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Public VAPID key the browser needs to create a push subscription. */
export function GET() {
  return NextResponse.json({
    ok: true,
    configured: env.pushConfigured,
    publicKey: env.vapid.publicKey || null,
  });
}
