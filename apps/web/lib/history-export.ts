import type { HistoryRow } from "./queries";

export const HISTORY_EXPORT_LIMIT = 5_000;

export type HistoryExportFilters = {
  result?: "correct" | "incorrect" | "pending";
  tag?: string;
  mediaType?: "image" | "video" | "link";
};

export type HistoryExportFilterResult =
  | { ok: true; filters: HistoryExportFilters }
  | { ok: false; error: string };

const RESULTS = new Set(["correct", "incorrect", "pending"]);
const MEDIA_TYPES = new Set(["image", "video", "link"]);
const TAG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseHistoryExportFilters(params: URLSearchParams): HistoryExportFilterResult {
  const result = params.get("result")?.trim() || undefined;
  const mediaType = params.get("media_type")?.trim() || undefined;
  const tag = params.get("tag")?.trim().toLowerCase() || undefined;

  if (result && !RESULTS.has(result)) {
    return { ok: false, error: "Invalid result filter." };
  }
  if (mediaType && !MEDIA_TYPES.has(mediaType)) {
    return { ok: false, error: "Invalid media_type filter." };
  }
  if (tag && !TAG_RE.test(tag)) {
    return { ok: false, error: "Invalid tag filter." };
  }

  return {
    ok: true,
    filters: {
      result: result as HistoryExportFilters["result"],
      tag,
      mediaType: mediaType as HistoryExportFilters["mediaType"],
    },
  };
}

function spreadsheetSafe(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  return `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
}

export function historyRowsToCsv(rows: HistoryRow[]): string {
  const header = [
    "media_id",
    "slug",
    "title",
    "media_type",
    "your_guess",
    "truth_label",
    "result",
    "guessed_at",
  ];
  const body = rows.map((row) => [
    row.mediaId,
    row.slug,
    row.title,
    row.mediaType,
    row.guess,
    row.truthLabel,
    row.isScored ? (row.isCorrect ? "correct" : "incorrect") : "pending",
    row.createdAt,
  ]);
  return `\uFEFF${[header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function historyExportFilename(now = new Date()): string {
  return `aiornot-guess-history-${now.toISOString().slice(0, 10)}.csv`;
}
