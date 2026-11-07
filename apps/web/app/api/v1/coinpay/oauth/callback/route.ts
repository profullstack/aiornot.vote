import { cookies } from "next/headers";
import { saveOpenProfileContact } from "@profullstack/profile";
import { profileStore } from "@/lib/user-profile";
import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { env } from "@/lib/env";
import { createSession, getCurrentUser } from "@/lib/session";
import { applyCoinpayPass } from "@/lib/coinpay-pass";
import { CHOICE_COOKIE, coinpayEnabled, coinpayOAuthConfig, finishCoinPay, STATE_COOKIE } from "@/lib/coinpay-signin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/coinpay/oauth/callback: CoinPay sends the browser back here.
 * Binds by CoinPay sub only (lib/coinpay-signin.ts), then signs in or links.
 */
export async function GET(req: Request) {
  const jar = await cookies();
  const cookieState = jar.get(STATE_COOKIE)?.value ?? null;
  jar.delete({ name: STATE_COOKIE, path: "/api/v1/coinpay/oauth" });
  jar.delete({ name: CHOICE_COOKIE, path: "/api/v1/coinpay/oauth" });
  const to = (path: string) => NextResponse.redirect(new URL(path, env.appUrl), 303);

  const oauth = coinpayOAuthConfig();
  if (!coinpayEnabled(oauth)) return to("/login?coinpay_error=not_configured");

  const sessionUser = await getCurrentUser();
  const outcome = await finishCoinPay(sqlClient, {
    params: new URL(req.url).searchParams,
    cookieState,
    sessionUserId: sessionUser?.id ?? null,
    appUrl: env.appUrl,
    oauth,
  });
  if (!outcome.ok) {
    return to(sessionUser ? `/account/settings?coinpay_error=${outcome.error}` : `/login?coinpay_error=${outcome.error}`);
  }
  // Profullstack Pass: the photo library until the pass ends, on the sub-bound account.
  if (outcome.kind !== "choose_account" && outcome.pass?.active) {
    try { await applyCoinpayPass(sqlClient, outcome.userId, outcome.pass); }
    catch (err) { console.error("[coinpay] pass:", (err as Error).message); }
  }
  if (outcome.kind === "linked") {
    if (outcome.openprofile_url) {
      try { await saveOpenProfileContact(profileStore(), outcome.userId, outcome.openprofile_url); }
      catch { console.warn("[coinpay] OpenProfile import skipped"); }
    }
    return to("/account/settings?coinpay=linked");
  }
  if (outcome.kind === "choose_account") {
    jar.set(CHOICE_COOKIE, outcome.choiceToken, {
      httpOnly: true,
      secure: env.appUrl.startsWith("https://"),
      sameSite: "lax",
      path: "/api/v1/coinpay/oauth",
      maxAge: 600,
    });
    return to("/login?coinpay_choose=1");
  }
  await createSession(outcome.userId);
  return to(outcome.kind === "welcome" ? "/account?coinpay=welcome" : "/account");
}
