import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { removeSubscription } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }
  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json({ ok: false, error: "Missing endpoint." }, { status: 400 });
  }
  await removeSubscription(user.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
