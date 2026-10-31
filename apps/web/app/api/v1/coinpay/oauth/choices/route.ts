import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { env } from "@/lib/env";
import { CHOICE_COOKIE, chooseCoinPayLoginAccount, coinpayLoginChoices } from "@/lib/coinpay-signin";
import { createSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const choices = await coinpayLoginChoices(sqlClient, jar.get(CHOICE_COOKIE)?.value);
  if (!choices) return NextResponse.json({ ok: false }, { status: 401, headers: { "cache-control": "no-store" } });
  return NextResponse.json({ ok: true, choices }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin) && new URL(origin!).origin === new URL(env.appUrl).origin;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) return NextResponse.json({ ok: false, error: "invalid_origin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId || userId.length > 200) return NextResponse.json({ ok: false, error: "invalid_account" }, { status: 400 });

  const jar = await cookies();
  const selected = await chooseCoinPayLoginAccount(sqlClient, jar.get(CHOICE_COOKIE)?.value, userId);
  if (!selected) {
    jar.delete({ name: CHOICE_COOKIE, path: "/api/v1/coinpay/oauth" });
    return NextResponse.json({ ok: false, error: "choice_expired" }, { status: 401 });
  }
  await createSession(selected);
  jar.delete({ name: CHOICE_COOKIE, path: "/api/v1/coinpay/oauth" });
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
