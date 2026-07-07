import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { generateContinuousBatch } from "@aiornot/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Continuous content top-up. Generates a small balanced batch of fresh media so
 * players never run out. Trigger on a schedule (e.g. every 15 min) with a cron
 * hitting this endpoint. Protect with CRON_SECRET (x-cron-secret header).
 * Default 3 images per run; override with ?count=.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") ?? "";
  if (!env.cronSecret || secret !== env.cronSecret) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const count = Math.min(10, Math.max(1, Number(new URL(req.url).searchParams.get("count")) || 3));
  try {
    const result = await generateContinuousBatch({ count });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
