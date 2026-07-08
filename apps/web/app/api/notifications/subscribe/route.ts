import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { saveSubscription, type BrowserSubscription } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Sign in and verify your email first." }, { status: 401 });
  }
  let body: { subscription?: BrowserSubscription };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const sub = body.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ ok: false, error: "Invalid subscription." }, { status: 400 });
  }
  try {
    await saveSubscription(user.id, sub, req.headers.get("user-agent"));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
