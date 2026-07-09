import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { scrapeUrl } from "@/lib/scrape";
import { createLinkPost } from "@/lib/linkposts";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Verify your email first." }, { status: 403 });
  }
  // Paid submit access gates new post submissions (keeps AI bots out).
  if (!user.canSubmit) {
    return NextResponse.json(
      { ok: false, error: "A one-time submit pass or lifetime membership is required to submit.", code: "needs_pass" },
      { status: 402 },
    );
  }
  if (!rateLimit(`submitlink:${user.id}`, 10, 10 * 60_000).ok) {
    return NextResponse.json({ ok: false, error: "Too many submissions. Try again soon." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const url = String(body.url || "").trim();
  if (!url) return NextResponse.json({ ok: false, error: "Paste a URL." }, { status: 400 });

  try {
    const scrape = await scrapeUrl(url);
    const created = await createLinkPost(user.id, scrape);
    if (!created.ok) return NextResponse.json(created, { status: 400 });
    return NextResponse.json({ ok: true, slug: created.slug });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
