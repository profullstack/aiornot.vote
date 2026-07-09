import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkSponsorship } from "@/lib/sponsorships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  const result = await checkSponsorship(id, user.id);
  if (!result) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, status: result.status });
}
