import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { castGuess, castGuessAnon } from "@/lib/guess";
import { getAnonRounds, bumpAnonRounds, ANON_FREE_ROUNDS } from "@/lib/anon";
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

  // Anonymous trial: a handful of free rounds before we ask them to join.
  if (!user || !canParticipate(user)) {
    if (user && !canParticipate(user)) {
      return NextResponse.json(
        { ok: false, error: "Verify your email to keep playing." },
        { status: 403 },
      );
    }
    const played = await getAnonRounds();
    if (played >= ANON_FREE_ROUNDS) {
      return NextResponse.json(
        {
          ok: false,
          code: "needs_signup",
          error: "That's your free plays — join free to keep going, save your streak, and hit the leaderboard.",
        },
        { status: 401 },
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
    const usedNow = await bumpAnonRounds();
    return NextResponse.json({ ...result, anon: true, freePlaysLeft: Math.max(0, ANON_FREE_ROUNDS - usedNow) });
  }

  const rl = rateLimit(`guess:${user.id}`, 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Slow down — too many guesses. Try again shortly." },
      { status: 429 },
    );
  }

  const ipHash = ip ? hashIp(ip) : null;
  const result = await castGuess(user.id, mediaId, guess as "ai" | "not_ai", ipHash, null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.code });
  }
  return NextResponse.json(result);
}
