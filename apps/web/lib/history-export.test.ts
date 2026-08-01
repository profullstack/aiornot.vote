import { describe, expect, it } from "vitest";
import {
  HISTORY_EXPORT_LIMIT,
  historyExportFilename,
  historyRowsToCsv,
  parseHistoryExportFilters,
} from "./history-export";
import type { HistoryRow } from "./queries";

function row(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    mediaId: "media-1",
    slug: "portrait-1",
    title: "Portrait",
    thumbnailUrl: null,
    mediaUrl: "https://images.example.test/portrait.jpg",
    mediaType: "image",
    guess: "ai",
    truthLabel: "not_ai",
    isScored: true,
    isCorrect: false,
    createdAt: "2026-08-01 12:34:56",
    ...overrides,
  };
}

describe("history export filters", () => {
  it("preserves supported result, tag, and media-type filters", () => {
    const params = new URLSearchParams({
      result: "correct",
      tag: " Portrait-Art ",
      media_type: "image",
    });
    expect(parseHistoryExportFilters(params)).toEqual({
      ok: true,
      filters: { result: "correct", tag: "portrait-art", mediaType: "image" },
    });
  });

  it("rejects unsupported filters instead of silently exporting another scope", () => {
    expect(parseHistoryExportFilters(new URLSearchParams("result=all"))).toEqual({
      ok: false,
      error: "Invalid result filter.",
    });
    expect(parseHistoryExportFilters(new URLSearchParams("media_type=audio"))).toEqual({
      ok: false,
      error: "Invalid media_type filter.",
    });
    expect(parseHistoryExportFilters(new URLSearchParams("tag=../../users"))).toEqual({
      ok: false,
      error: "Invalid tag filter.",
    });
  });

  it("keeps the export explicitly bounded", () => {
    expect(HISTORY_EXPORT_LIMIT).toBe(5_000);
  });
});

describe("history CSV serialization", () => {
  it("writes a UTF-8 BOM, RFC 4180 rows, and a final CRLF", () => {
    const csv = historyRowsToCsv([
      row({ title: 'A "quoted",\nmultiline title' }),
    ]);

    expect(csv.startsWith('\uFEFF"media_id","slug","title"')).toBe(true);
    expect(csv).toContain('"A ""quoted"",\nmultiline title"');
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("neutralizes spreadsheet formulas in untrusted text cells", () => {
    const csv = historyRowsToCsv([
      row({ title: '=HYPERLINK("https://attacker.test")', slug: "+cmd" }),
    ]);

    expect(csv).toContain('"\'=HYPERLINK(""https://attacker.test"")"');
    expect(csv).toContain('"\'+cmd"');
  });

  it("exports correct, incorrect, and pending result labels", () => {
    const csv = historyRowsToCsv([
      row({ mediaId: "correct", isCorrect: true }),
      row({ mediaId: "incorrect", isCorrect: false }),
      row({ mediaId: "pending", isScored: false, isCorrect: null }),
    ]);

    expect(csv).toContain('"correct"');
    expect(csv).toContain('"incorrect"');
    expect(csv).toContain('"pending"');
  });

  it("uses a fixed, filesystem-safe filename", () => {
    expect(historyExportFilename(new Date("2026-08-01T23:59:59Z"))).toBe(
      "aiornot-guess-history-2026-08-01.csv",
    );
  });
});
