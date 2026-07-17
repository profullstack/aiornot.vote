import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shareable referral link: /r/<code>. Drops a `ref` cookie (so the attribution
 * survives even if the friend signs up later) and forwards to the signup page
 * with the code prefilled.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const clean = (code || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 16);
  const res = NextResponse.redirect(new URL(`/signup?ref=${clean}`, env.appUrl));
  if (clean) {
    res.cookies.set("aon_ref", clean, {
      path: "/",
      maxAge: 30 * 86400,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
