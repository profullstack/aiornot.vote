import { NextResponse } from "next/server";
import { signup } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rl = rateLimit(`signup:${hashIp(ip)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  let body: { email?: string; password?: string; displayName?: string; ref?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // Referral code: explicit from the form wins, else fall back to the cookie
  // dropped by /r/<code>.
  const cookieRef = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("aon_ref="))
    ?.slice("aon_ref=".length);
  const ref = (body.ref && String(body.ref)) || (cookieRef ? decodeURIComponent(cookieRef) : null);

  const result = await signup(
    String(body.email || ""),
    String(body.password || ""),
    body.displayName ? String(body.displayName) : undefined,
    ref,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  await createSession(result.userId);
  return NextResponse.json({ ok: true, needsVerification: true });
}
