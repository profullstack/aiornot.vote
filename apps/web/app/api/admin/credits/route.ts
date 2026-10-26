import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin";
import { listCodes, mintLibraryCode } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/credits — every code (never the plaintext). Admin only. */
export async function GET() {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  return NextResponse.json({ ok: true, codes: await listCodes() });
}

/**
 * POST /api/admin/credits { days, label?, maxRedemptions?, expiresInDays? }
 * Mint a code worth `days` of the photo library pass. The code comes back once.
 */
export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const r = await mintLibraryCode({
    days: body.days,
    label: body.label,
    maxRedemptions: body.maxRedemptions ?? body.max_redemptions,
    expiresInDays: body.expiresInDays ?? body.expires_in_days,
    createdBy: gate.user.email,
  });
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  await audit(gate.user.id, "credit_code.mint", "credit_code", r.code.id, { days: r.code.days, max: r.code.maxRedemptions }).catch(() => {});
  return NextResponse.json(r);
}
