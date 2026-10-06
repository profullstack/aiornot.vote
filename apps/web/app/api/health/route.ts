import { NextResponse } from "next/server";
import { sqlClient } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** Liveness for status.profullstack.com: the app answers and the DB answers within 3s. */
export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      sqlClient.execute("select 1"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 3000);
      }),
    ]);
    return NextResponse.json({ status: "ok", db: "ok" }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ status: "error", db: "down" }, { status: 503, headers: NO_STORE });
  } finally {
    clearTimeout(timer);
  }
}
