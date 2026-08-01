import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";
import { displayNameUpdateStatement, readProfileRequest } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  }

  const body = await readProfileRequest(req);
  if (!body.ok) {
    return NextResponse.json({ ok: false, error: body.error }, { status: 400 });
  }

  await sqlClient.execute(displayNameUpdateStatement(user.id, body.displayName));
  return NextResponse.json({ ok: true, displayName: body.displayName });
}
