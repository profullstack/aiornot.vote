import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { recomputeMediaStats } from "@/lib/guess";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { id, action } = await params;

  const cur = await sqlClient.execute({ sql: "SELECT truth_label FROM media WHERE id = ?", args: [id] });
  if (cur.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Media not found." }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }

  switch (action) {
    case "approve":
      await sqlClient.execute({
        sql: "UPDATE media SET status='approved', approved_at=COALESCE(approved_at, CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP WHERE id=?",
        args: [id],
      });
      break;
    case "reject":
      await sqlClient.execute({ sql: "UPDATE media SET status='rejected', updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "hide":
      await sqlClient.execute({ sql: "UPDATE media SET status='hidden', updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "feature":
      await sqlClient.execute({ sql: "UPDATE media SET is_featured=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "unfeature":
      await sqlClient.execute({ sql: "UPDATE media SET is_featured=0, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "lock":
      await sqlClient.execute({ sql: "UPDATE media SET reveal_status='locked', locked_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "exclude-from-scoring":
      await sqlClient.execute({ sql: "UPDATE media SET is_score_eligible=0, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "include-in-scoring":
      await sqlClient.execute({ sql: "UPDATE media SET is_score_eligible=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      break;
    case "set-truth-label": {
      const label = String(body.truthLabel || "");
      if (!["ai", "not_ai", "unknown"].includes(label)) {
        return NextResponse.json({ ok: false, error: "Invalid truth label." }, { status: 400 });
      }
      await sqlClient.execute({
        sql: "UPDATE media SET truth_label=?, truth_confidence='admin_verified', updated_at=CURRENT_TIMESTAMP WHERE id=?",
        args: [label, id],
      });
      // Re-score existing guesses against the new truth.
      await sqlClient.execute({
        sql: `UPDATE guesses SET
                is_scored = CASE WHEN ? IN ('ai','not_ai') THEN 1 ELSE 0 END,
                is_correct = CASE WHEN ? IN ('ai','not_ai') THEN (CASE WHEN guess = ? THEN 1 ELSE 0 END) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
              WHERE media_id = ?`,
        args: [label, label, label, id],
      });
      await recomputeMediaStats(id, label as "ai" | "not_ai" | "unknown");
      // Recompute affected users' stats.
      const affected = await sqlClient.execute({ sql: "SELECT DISTINCT user_id FROM guesses WHERE media_id = ?", args: [id] });
      const { recomputeUserStats } = await import("@/lib/guess");
      for (const r of affected.rows) await recomputeUserStats(r.user_id as string);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  await audit(auth.user.id, `media.${action}`, "media", id, body);
  return NextResponse.json({ ok: true });
}
