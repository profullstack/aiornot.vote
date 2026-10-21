import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { libraryOriginalPath } from "@aiornot/seed";
import { getCurrentUser } from "@/lib/session";
import { env } from "@/lib/env";
import { downloadsSince, getLibraryPhoto, recordDownload } from "@/lib/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A licensed full-resolution download. Needs a live library pass (or admin). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Sign in to download." }, { status: 401 });
  }
  if (!user.hasLibraryAccess) {
    return NextResponse.json(
      { ok: false, error: "A photo library pass is required to download originals.", code: "needs_library_pass" },
      { status: 402 },
    );
  }

  const photo = await getLibraryPhoto({ id });
  if (!photo) return NextResponse.json({ ok: false, error: "Photo not found." }, { status: 404 });

  const since = new Date(Date.now() - 86400_000).toISOString();
  if (!user.isAdmin && (await downloadsSince(user.id, since)) >= env.libraryDailyDownloads) {
    return NextResponse.json(
      { ok: false, error: `Daily limit of ${env.libraryDailyDownloads} downloads reached. Try again tomorrow.` },
      { status: 429 },
    );
  }

  const path = libraryOriginalPath(photo.originalKey);
  if (!path || !existsSync(path)) {
    console.error(`[library] original missing for ${photo.id}: ${photo.originalKey}`);
    return NextResponse.json({ ok: false, error: "This file is unavailable right now." }, { status: 404 });
  }

  await recordDownload(user.id, photo.id);
  const size = (await stat(path)).size;
  const filename = `aiornot-${photo.slug}${extname(path) || ".jpg"}`;
  const body = Readable.toWeb(createReadStream(path)) as unknown as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": photo.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
