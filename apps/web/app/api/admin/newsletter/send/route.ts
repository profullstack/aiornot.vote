import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { sendNewsletterToAll } from "@/lib/newsletter";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const subject = String(body.subject || "").trim();
  const html = String(body.html || "").trim();
  if (!subject || !html) {
    return NextResponse.json({ ok: false, error: "Subject and body are required." }, { status: 400 });
  }
  try {
    const result = await sendNewsletterToAll(subject, html);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
