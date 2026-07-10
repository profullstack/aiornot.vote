import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { castGuess, castGuessAnon } from "@/lib/guess";
import { bumpAnonRounds, ANON_NAG_EVERY } from "@/lib/anon";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "";

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

  const user = await getCurrentUser();

  // Anonymous play: unlimited rounds, but every ANON_NAG_EVERY a dismissible
  // "join free" nag. Logged-in-but-unverified users must verify first.
  if (!user || !canParticipate(user)) {
    if (user && !canParticipate(user)) {
      return NextResponse.json(
        { ok: false, error: "Verify your email to keep playing." },
        { status: 403 },
      );
    }
    const rl = rateLimit(`guess-anon:${ip ? hashIp(ip) : "0"}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Slow down — too many guesses. Try again shortly." },
        { status: 429 },
      );
    }
    const result = await castGuessAnon(mediaId, guess as "ai" | "not_ai");
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.code });
    }
    const played = await bumpAnonRounds();
    return NextResponse.json({ ...result, anon: true, playsCount: played, nag: played % ANON_NAG_EVERY === 0 });
  }

  const rl = rateLimit(`guess:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Slow down — too many guesses. Try again shortly." },
      { status: 429 },
    );
  }

  const ipHash = ip ? hashIp(ip) : null;
  const result = await castGuess(user.id, mediaId, guess as "ai" | "not_ai", ipHash, null, user.isMember);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.code });
  }
  return NextResponse.json(result);
}
