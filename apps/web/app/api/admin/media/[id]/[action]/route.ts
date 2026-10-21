import { NextResponse } from "next/server";
import { requireAdminApi, audit } from "@/lib/admin";
import { sqlClient } from "@/lib/db";
import { recomputeMediaStats, recomputeUserStats } from "@/lib/guess";
import { readFile } from "node:fs/promises";
import { insertLibraryPhoto, libraryOriginalPath, publishLibraryFile } from "@aiornot/seed";

export const runtime = "nodejs";

type TruthLabel = "ai" | "not_ai" | "unknown";

function asTruthLabel(value: unknown): TruthLabel {
  return value === "ai" || value === "not_ai" ? value : "unknown";
}

async function recomputeAffectedUsers(mediaId: string): Promise<void> {
  const affected = await sqlClient.execute({
    sql: "SELECT DISTINCT user_id FROM guesses WHERE media_id = ?",
    args: [mediaId],
  });
  for (const r of affected.rows) await recomputeUserStats(r.user_id as string);
}

async function excludeFromScoring(mediaId: string, truthLabel: TruthLabel): Promise<void> {
  await sqlClient.execute({ sql: "UPDATE media SET is_score_eligible=0, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [mediaId] });
  await sqlClient.execute({
    sql: `UPDATE guesses SET is_scored=0, is_correct=NULL, updated_at=CURRENT_TIMESTAMP
          WHERE media_id=?`,
    args: [mediaId],
  });
  await recomputeMediaStats(mediaId, truthLabel);
  await recomputeAffectedUsers(mediaId);
}

const MIME_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * List a contributor's licensed photo in the library. The library shows the
 * answer in the open, so the item leaves game scoring at the same time.
 */
async function addToLibrary(mediaId: string): Promise<NextResponse | null> {
  const r = await sqlClient.execute({
    sql: `SELECT m.title, m.status, m.truth_label, m.library_original_key, m.submitter_user_id, u.display_name
          FROM media m LEFT JOIN users u ON u.id = m.submitter_user_id WHERE m.id = ? LIMIT 1`,
    args: [mediaId],
  });
  const m = r.rows[0];
  const key = (m?.library_original_key as string) ?? null;
  if (!m || !key) return NextResponse.json({ ok: false, error: "This item was not licensed for the library." }, { status: 400 });
  if (m.status !== "approved" || m.truth_label !== "not_ai") {
    return NextResponse.json({ ok: false, error: "Approve it and label it not_ai first." }, { status: 400 });
  }

  const existing = await sqlClient.execute({
    sql: "SELECT id FROM library_photos WHERE source = 'contributor' AND source_id = ? LIMIT 1",
    args: [mediaId],
  });
  if (existing.rows[0]) {
    await sqlClient.execute({ sql: "UPDATE library_photos SET status = 'listed' WHERE id = ?", args: [existing.rows[0].id] });
  } else {
    const path = libraryOriginalPath(key);
    if (!path) return NextResponse.json({ ok: false, error: "Bad original key." }, { status: 400 });
    const buf = await readFile(path);
    const mime = MIME_BY_EXT[key.split(".").pop() || ""] || "image/jpeg";
    const file = await publishLibraryFile(buf, mime, key);
    const tags = await sqlClient.execute({
      sql: `SELECT t.slug FROM media_tags mt JOIN tags t ON t.id = mt.tag_id
            WHERE mt.media_id = ? AND t.slug NOT IN ('image', 'video', 'photorealistic', 'human-made', 'ai-generated')`,
      args: [mediaId],
    });
    await insertLibraryPhoto(sqlClient, {
      title: String(m.title).replace(/^AI or Not:\s*/i, ""),
      photographer: (m.display_name as string) || null,
      source: "contributor",
      sourceId: mediaId,
      license: "contributor",
      contributorUserId: (m.submitter_user_id as string) ?? null,
      mediaId,
      tags: ["human-made", ...tags.rows.map((t) => t.slug as string)],
      file,
    });
  }
  await excludeFromScoring(mediaId, "not_ai");
  return null;
}

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
  const currentTruthLabel = asTruthLabel(cur.rows[0]?.truth_label);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }

  switch (action) {
    case "approve":
      await sqlClient.execute({
        sql: "UPDATE media SET status='approved', approved_at=COALESCE(approved_at, ?), updated_at=CURRENT_TIMESTAMP WHERE id=?",
        args: [new Date().toISOString(), id],
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
      await excludeFromScoring(id, currentTruthLabel);
      break;
    case "add-to-library": {
      const refused = await addToLibrary(id);
      if (refused) return refused;
      break;
    }
    case "remove-from-library":
      await sqlClient.execute({
        sql: "UPDATE library_photos SET status = 'hidden' WHERE source = 'contributor' AND source_id = ?",
        args: [id],
      });
      break;
    case "include-in-scoring":
      await sqlClient.execute({ sql: "UPDATE media SET is_score_eligible=1, updated_at=CURRENT_TIMESTAMP WHERE id=?", args: [id] });
      await sqlClient.execute({
        sql: `UPDATE guesses SET
                is_scored = CASE WHEN ? IN ('ai','not_ai') THEN 1 ELSE 0 END,
                is_correct = CASE WHEN ? IN ('ai','not_ai') THEN (CASE WHEN guess = ? THEN 1 ELSE 0 END) ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
              WHERE media_id = ?`,
        args: [currentTruthLabel, currentTruthLabel, currentTruthLabel, id],
      });
      await recomputeMediaStats(id, currentTruthLabel);
      await recomputeAffectedUsers(id);
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
      await recomputeAffectedUsers(id);
      break;
    }
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  await audit(auth.user.id, `media.${action}`, "media", id, body);
  return NextResponse.json({ ok: true });
}
