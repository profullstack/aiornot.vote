import { NextResponse } from "next/server";
import { getPublicOpinionResult } from "@/lib/opinions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/v1/opinions/:id — public crowd results for an opinion (no auth). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPublicOpinionResult(id);
  if (!result) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(result);
}
