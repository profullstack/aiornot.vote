import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { ids } from "@aiornot/db";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Name required." }, { status: 400 });
  const slug = slugify(body.slug ? String(body.slug) : name);

  const exists = await sqlClient.execute({ sql: "SELECT 1 FROM tags WHERE slug = ?", args: [slug] });
  if (exists.rows.length > 0) {
    return NextResponse.json({ ok: false, error: "A tag with that slug exists." }, { status: 409 });
  }
  await sqlClient.execute({
    sql: `INSERT INTO tags (id, slug, name, description, is_default, is_answer_spoiler)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [ids.tag(), slug, name, body.description || null, body.isDefault ? 1 : 0, body.isAnswerSpoiler ? 1 : 0],
  });
  await audit(auth.user.id, "tag.create", "tag", slug);
  return NextResponse.json({ ok: true, slug });
}
