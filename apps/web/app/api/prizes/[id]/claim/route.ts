import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { claimPrize } from "@/lib/prizes";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const { id } = await params;
  const result = await claimPrize(user.id, id);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, rewardLabel: result.rewardLabel });
}
