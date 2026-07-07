import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rl = rateLimit(`pwreset:${hashIp(ip)}`, 3, 5 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Please wait before requesting again." }, { status: 429 });
  }

  let email = "";
  try {
    const body = await req.json();
    email = String(body.email || "");
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (email) await requestPasswordReset(email);
  // Always succeed to avoid revealing whether an account exists.
  return NextResponse.json({ ok: true });
}
