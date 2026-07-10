import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicOpinionResult } from "./opinions";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./db", () => ({
  sqlClient: {
    execute: mocks.execute,
  },
}));

function sqlText(query: unknown): string {
  if (typeof query === "string") return query;
  return String((query as { sql?: unknown }).sql ?? "");
}

describe("getPublicOpinionResult", () => {
  beforeEach(() => {
    mocks.execute.mockReset();
  });

  it("hides members-only media from the public opinions endpoint", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media_tags mt JOIN tags")) {
        return { rows: [{ exists: 1 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getPublicOpinionResult("media_private")).resolves.toBeNull();
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.objectContaining({ sql: expect.stringContaining("FROM media m LEFT JOIN media_stats") }),
    );
  });

  it("returns public opinion results for visible approved media", async () => {
    mocks.execute.mockImplementation(async (query: unknown) => {
      const sql = sqlText(query);
      if (sql.includes("FROM media_tags mt JOIN tags")) {
        return { rows: [] };
      }
      if (sql.includes("FROM media m LEFT JOIN media_stats")) {
        return {
          rows: [{
            id: "media_public",
            slug: "public-opinion",
            title: "Public opinion",
            media_url: "https://example.com/image.jpg",
            created_at: "2026-07-09T00:00:00.000Z",
            ai: 7,
            not_ai: 3,
            total: 10,
          }],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    await expect(getPublicOpinionResult("media_public")).resolves.toMatchObject({
      id: "media_public",
      image_url: "https://example.com/image.jpg",
      votes: { ai: 7, not_ai: 3, total: 10 },
      ai_percent: 70,
      verdict: "likely_ai",
    });
  });
});
