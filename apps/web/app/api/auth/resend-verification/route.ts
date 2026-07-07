import { NextResponse } from "next/server";
import { resendVerification } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rl = rateLimit(`resend:${hashIp(ip)}`, 3, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Please wait before requesting again." }, { status: 429 });
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body.email || "");
  } catch {
    /* fall through */
  }
  // Prefer the logged-in user's own email if present.
  const user = await getCurrentUser();
  if (user) email = user.email;
  if (email) await resendVerification(email);
  return NextResponse.json({ ok: true });
}
