import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { spendPowerup, type PowerupKind } from "@/lib/rewards";

export const runtime = "nodejs";
export const maxDuration = 60;

const KINDS: PowerupKind[] = ["hint", "ai_scan", "ai_verdict"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const mediaId = String(body.mediaId || "");
  const kind = String(body.kind || "") as PowerupKind;
  if (!mediaId || !KINDS.includes(kind)) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const result = await spendPowerup(user.id, mediaId, kind);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
