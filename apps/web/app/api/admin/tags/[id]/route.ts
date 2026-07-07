import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";

export const runtime = "nodejs";

// :id here is the tag slug for convenience.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id: slug } = await params;
  const body = await req.json().catch(() => ({}));
  const sets: string[] = [];
  const args: unknown[] = [];
  if (typeof body.name === "string") { sets.push("name = ?"); args.push(body.name.trim()); }
  if (typeof body.description === "string") { sets.push("description = ?"); args.push(body.description); }
  if (typeof body.isVisible === "boolean") { sets.push("is_visible = ?"); args.push(body.isVisible ? 1 : 0); }
  if (typeof body.isAnswerSpoiler === "boolean") { sets.push("is_answer_spoiler = ?"); args.push(body.isAnswerSpoiler ? 1 : 0); }
  if (sets.length === 0) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  sets.push("updated_at = CURRENT_TIMESTAMP");
  args.push(slug);
  await sqlClient.execute({ sql: `UPDATE tags SET ${sets.join(", ")} WHERE slug = ?`, args: args as never[] });
  await audit(auth.user.id, "tag.edit", "tag", slug, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id: slug } = await params;
  await sqlClient.execute({ sql: "DELETE FROM tags WHERE slug = ? AND is_default = 0", args: [slug] });
  await audit(auth.user.id, "tag.delete", "tag", slug);
  return NextResponse.json({ ok: true });
}
