import { createClient, type Client, type InStatement } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getMostFollowed, getMostFollowing } from "./social";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sqlClient: { execute: mocks.execute } }));

let client: Client;

describe("follow leaderboards", () => {
  beforeAll(async () => {
    client = createClient({ url: "file::memory:" });
    mocks.execute.mockImplementation((statement: InStatement) => client.execute(statement));
    await client.execute(`CREATE TABLE users (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      status TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE follows (
      follower_id TEXT NOT NULL,
      followee_id TEXT NOT NULL,
      PRIMARY KEY (follower_id, followee_id)
    )`);
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM follows");
    await client.execute("DELETE FROM users");
    await client.execute(`INSERT INTO users (id, display_name, status) VALUES
      ('target', 'Target', 'active'),
      ('active-follower', 'Active follower', 'active'),
      ('suspended-follower', 'Suspended follower', 'suspended'),
      ('active-followee', 'Active followee', 'active'),
      ('deleted-followee', 'Deleted followee', 'deleted')`);
    await client.execute(`INSERT INTO follows (follower_id, followee_id) VALUES
      ('active-follower', 'target'),
      ('suspended-follower', 'target'),
      ('target', 'active-followee'),
      ('target', 'deleted-followee')`);
  });

  afterAll(() => client.close());

  it("counts only active followers for the most-followed board", async () => {
    const rows = await getMostFollowed();
    expect(rows.find((row) => row.userId === "target")?.count).toBe(1);
    expect(rows.map((row) => row.userId)).not.toContain("suspended-follower");
    expect(rows.map((row) => row.userId)).not.toContain("deleted-followee");
  });

  it("counts only active followees for the most-following board", async () => {
    const rows = await getMostFollowing();
    expect(rows.find((row) => row.userId === "target")?.count).toBe(1);
    expect(rows.map((row) => row.userId)).not.toContain("suspended-follower");
    expect(rows.map((row) => row.userId)).not.toContain("deleted-followee");
  });
});
