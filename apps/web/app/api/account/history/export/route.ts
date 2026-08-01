import { NextResponse } from "next/server";
import {
  HISTORY_EXPORT_LIMIT,
  historyExportFilename,
  historyRowsToCsv,
  parseHistoryExportFilters,
} from "@/lib/history-export";
import { getUserHistory } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const parsed = parseHistoryExportFilters(new URL(req.url).searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const rows = await getUserHistory(user.id, {
    ...parsed.filters,
    limit: HISTORY_EXPORT_LIMIT,
  });
  return new NextResponse(historyRowsToCsv(rows), {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${historyExportFilename()}"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}
