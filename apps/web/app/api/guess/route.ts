import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { castGuess } from "@/lib/guess";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to guess." }, { status: 401 });
  }
  if (!canParticipate(user)) {
    return NextResponse.json(
      { ok: false, error: "Verify your email before guessing." },
      { status: 403 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";
  const rl = rateLimit(`guess:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Slow down — too many guesses. Try again shortly." },
      { status: 429 },
    );
  }

  let body: { mediaId?: string; guess?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const mediaId = String(body.mediaId || "");
  const guess = String(body.guess || "");
  if (!mediaId || (guess !== "ai" && guess !== "not_ai")) {
    return NextResponse.json({ ok: false, error: "Invalid guess." }, { status: 400 });
  }

  const ipHash = ip ? hashIp(ip) : null;
  const uaHash = null;
  const result = await castGuess(user.id, mediaId, guess as "ai" | "not_ai", ipHash, uaHash);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.code });
  }
  return NextResponse.json(result);
}
