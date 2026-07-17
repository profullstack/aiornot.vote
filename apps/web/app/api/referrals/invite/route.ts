import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendInvites } from "@/lib/referrals";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to invite friends." }, { status: 401 });
  }
  if (!user.emailVerified) {
    return NextResponse.json({ ok: false, error: "Verify your email before inviting friends." }, { status: 403 });
  }
  const rl = rateLimit(`invite:${user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Slow down — try again in a minute." }, { status: 429 });
  }

  let body: { emails?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Accept an array of emails, or a single string with any common separators.
  let list: string[] = [];
  if (Array.isArray(body.emails)) {
    list = body.emails.map((e) => String(e));
  } else if (typeof body.emails === "string") {
    list = body.emails.split(/[\s,;]+/);
  }

  const result = await sendInvites(user.id, user.displayName, list);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
