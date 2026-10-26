import { NextResponse } from "next/server";
import { saveSignupProfile, validateProfile } from "@profullstack/profile";
import { signup } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { profileStore } from "@/lib/user-profile";
import { INVITE_COOKIE, looksLikeInvite } from "@/lib/invite-code";

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rl = await rateLimit(`signup:${hashIp(ip)}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  let body: {
    email?: string;
    password?: string;
    displayName?: unknown;
    ref?: string;
    invite?: string;
    [field: string]: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  // The shared profile fields (@profullstack/profile), checked before any
  // account exists. Required: first and last name (and the email above).
  const check = validateProfile(body);
  if (!check.ok) {
    const errors = check.errors as Record<string, string>;
    return NextResponse.json(
      { ok: false, error: Object.values(errors)[0] ?? "Some fields need fixing.", errors },
      { status: 400 },
    );
  }

  // Referral code: explicit from the form wins, else fall back to the cookie
  // dropped by /r/<code>.
  const cookieRef = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("aon_ref="))
    ?.slice("aon_ref=".length);
  let ref = (body.ref && String(body.ref)) || null;
  if (!ref && cookieRef) {
    try {
      ref = decodeURIComponent(cookieRef);
    } catch {
      ref = null;
    }
  }

  // Invite code: from the form (?invite=), else the cookie /i/<code> set. It is
  // held on the new account until the email is verified (lib/credits).
  const cookieInvite = readCookie(req, INVITE_COOKIE);
  const invite = [body.invite, cookieInvite].find(looksLikeInvite) ?? null;

  const result = await signup(
    String(body.email || ""),
    String(body.password || ""),
    body.displayName,
    ref,
    invite,
  );
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  // Saved once the user exists. A failure is logged, never fatal: account
  // settings ask again.
  await saveSignupProfile(profileStore(), result.userId, body).catch((err: Error) =>
    console.error("[signup] profile save failed:", err.message),
  );
  await createSession(result.userId);
  const res = NextResponse.json({ ok: true, needsVerification: true });
  if (cookieInvite) res.cookies.set(INVITE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
