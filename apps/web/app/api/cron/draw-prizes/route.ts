import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { drawWeeklyPrizes } from "@/lib/prizes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Weekly prize draw, triggered by cron. Protect with CRON_SECRET
 * (x-cron-secret header). Idempotent per week.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!env.cronSecret || secret !== env.cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const result = await drawWeeklyPrizes();
  return NextResponse.json({ ok: true, ...result });
}
