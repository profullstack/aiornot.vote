import { NextResponse } from "next/server";
import { getCurrentUser, canParticipate } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

/** Send a test push to the current user's own devices. */
export async function POST() {
  const user = await getCurrentUser();
  if (!canParticipate(user)) {
    return NextResponse.json({ ok: false, error: "Sign in and verify your email first." }, { status: 401 });
  }
  const res = await sendPushToUser(user.id, {
    title: "AIorNot.vote 🔔",
    body: "Notifications are on. We'll ping you when it's time to play.",
    url: "/play",
    tag: "test",
  });
  return NextResponse.json({ ok: true, ...res });
}
