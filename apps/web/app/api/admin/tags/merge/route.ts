import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";

export const runtime = "nodejs";

/** Merge tag `from` into `to` (both slugs); re-points media_tags and deletes `from`. */
export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const from = String(body.from || "");
  const to = String(body.to || "");
  if (!from || !to || from === to) {
    return NextResponse.json({ ok: false, error: "Provide distinct from/to slugs." }, { status: 400 });
  }
  const fromT = await sqlClient.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [from] });
  const toT = await sqlClient.execute({ sql: "SELECT id FROM tags WHERE slug = ?", args: [to] });
  const fromId = fromT.rows[0]?.id as string | undefined;
  const toId = toT.rows[0]?.id as string | undefined;
  if (!fromId || !toId) return NextResponse.json({ ok: false, error: "Tag not found." }, { status: 404 });

  await sqlClient.execute({
    sql: "INSERT OR IGNORE INTO media_tags (media_id, tag_id) SELECT media_id, ? FROM media_tags WHERE tag_id = ?",
    args: [toId, fromId],
  });
  await sqlClient.execute({ sql: "DELETE FROM media_tags WHERE tag_id = ?", args: [fromId] });
  await sqlClient.execute({ sql: "DELETE FROM tags WHERE id = ? AND is_default = 0", args: [fromId] });
  await audit(auth.user.id, "tag.merge", "tag", from, { to });
  return NextResponse.json({ ok: true });
}
