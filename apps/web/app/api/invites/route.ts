import { NextResponse } from "next/server";
import { requestOrigin, requestUser } from "@/lib/request-user";
import { createInvite, myInvites } from "@/lib/credits";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/invites — my quota, my invites (codes are never shown again) and the bonus. */
export async function GET(req: Request) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await myInvites(user.id)) });
}

/** POST /api/invites { note? } — make one invite. The code and link come back once. */
export async function POST(req: Request) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  if (!(await rateLimit(`invite-create:${user.id}`, 10, 60_000)).ok) {
    return NextResponse.json({ ok: false, error: "Slow down. Try again in a minute." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  const r = await createInvite(user.id, body.note, requestOrigin(req));
  if (!r.ok) return NextResponse.json(r, { status: 409 });
  return NextResponse.json(r);
}
