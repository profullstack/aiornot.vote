import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { generateNewsletter, countActiveRecipients } from "@/lib/newsletter";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "");
  try {
    const [draft, recipients] = await Promise.all([generateNewsletter(prompt), countActiveRecipients()]);
    return NextResponse.json({ ok: true, ...draft, recipients });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
