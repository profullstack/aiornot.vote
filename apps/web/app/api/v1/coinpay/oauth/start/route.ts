import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { env } from "@/lib/env";
import { hashIp } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/session";
import { coinpayEnabled, coinpayOAuthConfig, startCoinPay, STATE_COOKIE } from "@/lib/coinpay-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/coinpay/oauth/start?mode=login|link: 302 to CoinPay's consent.
 * `link` (Connect CoinPay) needs a signed-in account; `login` needs none.
 */
export async function GET(req: Request) {
  const back = (error: string) => NextResponse.redirect(new URL(`/login?coinpay_error=${error}`, env.appUrl), 302);
  const oauth = coinpayOAuthConfig();
  if (!coinpayEnabled(oauth)) return back("not_configured");

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const rl = await rateLimit(`coinpay:${hashIp(ip)}`, 30, 15 * 60_000);
  if (!rl.ok) return back("rate_limited");

  const mode = new URL(req.url).searchParams.get("mode") === "link" ? "link" : "login";
  let userId: string | null = null;
  if (mode === "link") {
    const user = await getCurrentUser();
    if (!user) return back("sign_in_first");
    userId = user.id;
  }

  const { url, state } = await startCoinPay(sqlClient, { mode, userId, appUrl: env.appUrl, oauth });
  const res = NextResponse.redirect(url, 302);
  res.headers.set("cache-control", "no-store");
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/api/v1/coinpay/oauth",
    maxAge: 600,
  });
  return res;
}
