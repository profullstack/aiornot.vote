import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const args: unknown[] = [];
  if (typeof body.role === "string" && ["user", "moderator", "admin"].includes(body.role)) {
    sets.push("role = ?"); args.push(body.role);
  }
  if (typeof body.status === "string" && ["active", "suspended", "deleted"].includes(body.status)) {
    sets.push("status = ?"); args.push(body.status);
  }
  if (sets.length === 0) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  sets.push("updated_at = CURRENT_TIMESTAMP");
  args.push(id);
  await sqlClient.execute({ sql: `UPDATE users SET ${sets.join(", ")} WHERE id = ?`, args: args as never[] });
  await audit(auth.user.id, "user.edit", "user", id, body);
  return NextResponse.json({ ok: true });
}
