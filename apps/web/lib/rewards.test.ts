import { createClient, type Client, type InStatement } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { spendPowerup } from "./rewards";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  batch: vi.fn(),
  newId: vi.fn(),
  analyzeImage: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./db", () => ({
  sqlClient: {
    execute: mocks.execute,
    batch: mocks.batch,
  },
}));

vi.mock("@aiornot/db", () => ({
  newId: mocks.newId,
}));

vi.mock("./ai-vision", () => ({
  analyzeImage: mocks.analyzeImage,
}));

let client: Client;
let nextId = 0;

function sqlText(statement: unknown): string {
  if (typeof statement === "string") return statement;
  return String((statement as { sql?: unknown }).sql ?? "");
}

async function seedPowerups({ hints = 0, aiScans = 0 }: { hints?: number; aiScans?: number } = {}) {
  await client.execute({
    sql: "INSERT INTO user_powerups (user_id, hints, ai_scans) VALUES (?, ?, ?)",
    args: ["user_1", hints, aiScans],
  });
}

describe("spendPowerup", () => {
  beforeAll(async () => {
    client = createClient({ url: "file::memory:" });
    await client.execute("CREATE TABLE media (id TEXT PRIMARY KEY, status TEXT NOT NULL, media_url TEXT NOT NULL)");
    await client.execute("CREATE TABLE tags (id TEXT PRIMARY KEY, members_only INTEGER NOT NULL DEFAULT 0)");
    await client.execute("CREATE TABLE media_tags (media_id TEXT NOT NULL, tag_id TEXT NOT NULL)");
    await client.execute(`CREATE TABLE user_powerups (
      user_id TEXT PRIMARY KEY,
      hints INTEGER NOT NULL DEFAULT 0,
      ai_scans INTEGER NOT NULL DEFAULT 0,
      ai_verdicts INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await client.execute(`CREATE TABLE powerup_uses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      media_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      UNIQUE (user_id, media_id, kind)
    )`);
    await client.execute("CREATE TABLE media_stats (media_id TEXT PRIMARY KEY, ai_guesses INTEGER, total_guesses INTEGER)");
    await client.execute("CREATE TABLE tips (text TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1)");
    await client.execute(`CREATE TABLE ai_analyses (
      media_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (media_id, kind)
    )`);
  });

  beforeEach(async () => {
    const tables = [
      "powerup_uses",
      "user_powerups",
      "media_tags",
      "tags",
      "media_stats",
      "tips",
      "ai_analyses",
      "media",
    ];
    for (const table of tables) {
      await client.execute(`DELETE FROM ${table}`);
    }
    await client.execute(
      "INSERT INTO media (id, status, media_url) VALUES ('media_1', 'approved', 'https://example.com/1.jpg'), ('media_2', 'approved', 'https://example.com/2.jpg')",
    );
    await client.execute(
      "INSERT INTO media_stats (media_id, ai_guesses, total_guesses) VALUES ('media_1', 3, 5), ('media_2', 1, 4)",
    );
    await client.execute("INSERT INTO tips (text) VALUES ('Check the edges.')");

    nextId = 0;
    mocks.newId.mockReset();
    mocks.newId.mockImplementation((prefix: string) => `${prefix}_test_${++nextId}`);
    mocks.analyzeImage.mockReset();
    mocks.analyzeImage.mockResolvedValue("Scan result");
    mocks.execute.mockReset();
    mocks.execute.mockImplementation((statement: InStatement) => client.execute(statement));
    mocks.batch.mockReset();
    mocks.batch.mockImplementation((statements: InStatement[]) => client.batch(statements, "write"));
  });

  afterAll(() => {
    client.close();
  });

  it("charges only once when the same unlock is requested concurrently", async () => {
    await seedPowerups({ hints: 2 });

    let existingReads = 0;
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    let debits = 0;
    let releaseDebits!: () => void;
    const bothDebited = new Promise<void>((resolve) => { releaseDebits = resolve; });

    mocks.execute.mockImplementation(async (statement: InStatement) => {
      const sql = sqlText(statement);
      const result = await client.execute(statement);

      if (sql.includes("SELECT 1 FROM powerup_uses") && sql.includes("LIMIT 1") && existingReads < 2) {
        existingReads++;
        if (existingReads === 2) releaseReads();
        await bothRead;
      }

      // This second barrier makes the regression deterministic against the old
      // SELECT -> debit -> INSERT OR IGNORE sequence: both debits land before
      // either request is allowed to record its unique use.
      if (sql.includes("UPDATE user_powerups SET hints = hints - 1")) {
        debits++;
        if (debits === 2) releaseDebits();
        await bothDebited;
      }
      return result;
    });

    const results = await Promise.all([
      spendPowerup("user_1", "media_1", "hint"),
      spendPowerup("user_1", "media_1", "hint"),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const balance = await client.execute("SELECT hints FROM user_powerups WHERE user_id = 'user_1'");
    const uses = await client.execute("SELECT COUNT(*) AS count FROM powerup_uses");
    expect(Number(balance.rows[0]?.hints)).toBe(1);
    expect(Number(uses.rows[0]?.count)).toBe(1);
  });

  it("does not create an unlock when the balance is empty", async () => {
    await seedPowerups();

    await expect(spendPowerup("user_1", "media_1", "hint")).resolves.toEqual({
      ok: false,
      error: "You don't have that reward yet — build a streak to earn it.",
    });
    const balance = await client.execute("SELECT hints FROM user_powerups WHERE user_id = 'user_1'");
    const uses = await client.execute("SELECT COUNT(*) AS count FROM powerup_uses");
    expect(Number(balance.rows[0]?.hints)).toBe(0);
    expect(Number(uses.rows[0]?.count)).toBe(0);
  });

  it("charges independent unlocks for different media and kinds", async () => {
    await seedPowerups({ hints: 2, aiScans: 1 });

    const results = await Promise.all([
      spendPowerup("user_1", "media_1", "hint"),
      spendPowerup("user_1", "media_2", "hint"),
      spendPowerup("user_1", "media_1", "ai_scan"),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const balance = await client.execute(
      "SELECT hints, ai_scans FROM user_powerups WHERE user_id = 'user_1'",
    );
    const uses = await client.execute("SELECT COUNT(*) AS count FROM powerup_uses");
    expect(balance.rows[0]).toMatchObject({ hints: 0, ai_scans: 0 });
    expect(Number(uses.rows[0]?.count)).toBe(3);
  });
});
