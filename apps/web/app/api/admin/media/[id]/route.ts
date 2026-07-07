import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { domainOf } from "@/lib/url-guard";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const sets: string[] = [];
  const args: unknown[] = [];
  if (typeof body.title === "string") { sets.push("title = ?"); args.push(body.title.trim()); }
  if (typeof body.description === "string") { sets.push("description = ?"); args.push(body.description); }
  if (typeof body.sourceUrl === "string") {
    sets.push("source_url = ?", "source_domain = ?");
    args.push(body.sourceUrl, domainOf(body.sourceUrl));
  }
  if (sets.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }
  sets.push("updated_at = CURRENT_TIMESTAMP");
  args.push(id);
  await sqlClient.execute({ sql: `UPDATE media SET ${sets.join(", ")} WHERE id = ?`, args: args as never[] });
  await audit(auth.user.id, "media.edit", "media", id, body);
  return NextResponse.json({ ok: true });
}
