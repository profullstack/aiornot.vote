import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth";

export const runtime = "nodejs";

/** Programmatic verification endpoint (the /verify-email page is the human one). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
