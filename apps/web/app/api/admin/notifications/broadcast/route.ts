import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { broadcastPush } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  let body: { title?: string; body?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const title = String(body.title || "").trim().slice(0, 80);
  const text = String(body.body || "").trim().slice(0, 200);
  const url = String(body.url || "/play").trim().slice(0, 300) || "/play";
  if (!title || !text) {
    return NextResponse.json({ ok: false, error: "Title and body are required." }, { status: 400 });
  }
  const res = await broadcastPush({ title, body: text, url, tag: "broadcast" });
  await audit(auth.user.id, "push_broadcast", "notification", "broadcast", { title, ...res });
  return NextResponse.json({ ok: true, ...res });
}
