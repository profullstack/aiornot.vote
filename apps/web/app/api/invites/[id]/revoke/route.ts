import { NextResponse } from "next/server";
import { requestUser } from "@/lib/request-user";
import { revokeInvite } from "@/lib/credits";

export const runtime = "nodejs";

/** POST /api/invites/<id>/revoke — withdraw one of my unused invites (the slot comes back). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requestUser(req);
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const r = await revokeInvite(user.id, id);
  return NextResponse.json(r, { status: r.ok ? 200 : 404 });
}
