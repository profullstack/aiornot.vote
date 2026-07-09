import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createSponsorship } from "@/lib/sponsorships";
import { rateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/crypto";
import { normalizeCoinpayBlockchain } from "@/lib/coinpay-blockchains";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to sponsor a prize." }, { status: 401 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!rateLimit(`sponsor:${user.id}:${hashIp(ip)}`, 8, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again soon." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const blockchain = normalizeCoinpayBlockchain(body.blockchain);
  if (!blockchain) return NextResponse.json({ ok: false, error: "Unsupported payment network." }, { status: 400 });

  const result = await createSponsorship({
    userId: user.id,
    sponsorName: String(body.sponsorName || ""),
    sponsorUrl: body.sponsorUrl ? String(body.sponsorUrl) : null,
    prizeLabel: String(body.prizeLabel || ""),
    message: body.message ? String(body.message) : null,
    amountUsd: Number(body.amountUsd),
    blockchain,
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ok: true, sponsorshipId: result.id });
}
