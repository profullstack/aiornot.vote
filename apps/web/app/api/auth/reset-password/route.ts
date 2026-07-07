import { NextResponse } from "next/server";
import { resetPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rl = rateLimit(`pwreset-consume:${hashIp(ip)}`, 10, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await resetPassword(String(body.token || ""), String(body.password || ""));
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  // Log the user in after a successful reset.
  await createSession(result.userId);
  return NextResponse.json({ ok: true });
}
