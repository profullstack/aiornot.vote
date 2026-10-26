import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin";
import { revokeCode } from "@/lib/credits";

export const runtime = "nodejs";

/** POST /api/admin/credits/<id>/revoke — withdraw a code. Admin only. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  if (!(await revokeCode(id))) return NextResponse.json({ ok: false, error: "No such code." }, { status: 404 });
  await audit(gate.user.id, "credit_code.revoke", "credit_code", id).catch(() => {});
  return NextResponse.json({ ok: true });
}
