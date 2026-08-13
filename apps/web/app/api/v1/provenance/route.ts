import { NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/entitlements";
import { validateExternalUrl } from "@/lib/url-guard";
import { rateLimit } from "@/lib/rate-limit";
import { readProvenance, PROVENANCE_SCAN_BYTES } from "@/lib/provenance";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 10_000;
const UA = "aiornot.vote-provenance/1.0 (+https://aiornot.vote/api)";

function bearer(req: Request): string {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * Reads the head of a remote file, stopping once there is enough to inspect.
 *
 * Provenance metadata lives near the front of every container we handle, so
 * there is no reason to pull a 40MB image over the wire to read 2KB of XMP.
 * The cap is also the safety limit: a hostile URL cannot stream unboundedly.
 */
async function fetchHead(url: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Range: `bytes=0-${PROVENANCE_SCAN_BYTES - 1}` },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Fetch failed (${response.status}).`);
    }

    const contentType = (response.headers.get("content-type") || "").split(";")[0]!.trim();

    // A server that ignores Range sends the whole file; read only what fits.
    const chunks: Uint8Array[] = [];
    let total = 0;

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response body.");

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      chunks.push(value);
      total += value.length;

      if (total >= PROVENANCE_SCAN_BYTES) {
        await reader.cancel();
        break;
      }
    }

    const bytes = new Uint8Array(Math.min(total, PROVENANCE_SCAN_BYTES));
    let offset = 0;
    for (const chunk of chunks) {
      const room = bytes.length - offset;
      if (room <= 0) break;
      const slice = chunk.subarray(0, room);
      bytes.set(slice, offset);
      offset += slice.length;
    }

    return { bytes, contentType };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * POST /api/v1/provenance — read what a file declares about how it was made.
 *
 * This is the deterministic counterpart to `/api/v1/opinions`: it answers
 * immediately from signed and self-declared metadata, where an opinion needs
 * humans and time. Neither is a detector, and the response says so.
 *
 * Auth: Authorization: Bearer <aion_live_…>. Body: { media_url }.
 */
export async function POST(req: Request) {
  const auth = await verifyApiKey(bearer(req));
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key." }, { status: 401 });
  }
  if (!(await rateLimit(`v1prov:${auth.keyId}`, 60, 60_000)).ok) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const mediaUrl = String(body.media_url || body.mediaUrl || body.image_url || "");

  const guard = validateExternalUrl(mediaUrl);
  if (!guard.ok) {
    return NextResponse.json({ error: `media_url: ${guard.error}` }, { status: 400 });
  }

  let head: { bytes: Uint8Array; contentType: string };
  try {
    head = await fetchHead(guard.url.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed.";
    return NextResponse.json({ error: `Could not read the file: ${message}` }, { status: 502 });
  }

  if (head.bytes.length === 0) {
    return NextResponse.json({ error: "The file was empty." }, { status: 400 });
  }

  const report = readProvenance(head.bytes);

  return NextResponse.json({
    media_url: guard.url.toString(),
    content_type: head.contentType || null,
    bytes_inspected: head.bytes.length,
    provenance: {
      signals: report.signals,
      strength: report.strength,
      declared_ai_generated: report.declaredAiGenerated,
      c2pa: {
        present: report.c2pa.present,
        container: report.c2pa.container ?? null,
        signature_verified: report.c2pa.signatureVerified,
      },
      digital_source_type: report.digitalSourceType ?? null,
      digital_source_type_label: report.digitalSourceTypeLabel ?? null,
      generators: report.generators,
      synthid: report.synthid,
      notes: report.notes,
    },
    note:
      "This reports what the file declares about itself. It is not an AI detector, and a file " +
      "with no provenance is not evidence either way. For a human read, submit it to " +
      "/api/v1/opinions.",
  });
}
