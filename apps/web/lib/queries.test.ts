import { createClient, type Client, type InStatement } from "@libsql/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTagBySlug, listTags } from "./queries";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("./db", () => ({
  sqlClient: {
    execute: mocks.execute,
  },
}));

let client: Client;

describe("tag media counts", () => {
  beforeAll(async () => {
    client = createClient({ url: "file::memory:" });
    mocks.execute.mockImplementation((statement: InStatement) => client.execute(statement));

    await client.execute(`CREATE TABLE tags (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_answer_spoiler INTEGER NOT NULL DEFAULT 0,
      members_only INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1
    )`);
    await client.execute("CREATE TABLE media (id TEXT PRIMARY KEY, status TEXT NOT NULL)");
    await client.execute("CREATE TABLE media_tags (media_id TEXT NOT NULL, tag_id TEXT NOT NULL)");
  });

  beforeEach(async () => {
    await client.execute("DELETE FROM media_tags");
    await client.execute("DELETE FROM media");
    await client.execute("DELETE FROM tags");

    await client.execute("INSERT INTO tags (id, slug, name) VALUES ('tag_public', 'animals', 'Animals')");
    await client.execute(
      "INSERT INTO tags (id, slug, name, members_only) VALUES ('tag_gated', 'members', 'Members', 1)",
    );
    await client.execute("INSERT INTO media (id, status) VALUES ('media_public', 'approved'), ('media_gated', 'approved')");
    await client.execute(
      `INSERT INTO media_tags (media_id, tag_id) VALUES
        ('media_public', 'tag_public'),
        ('media_gated', 'tag_public'),
        ('media_gated', 'tag_gated')`,
    );
  });

  afterAll(() => {
    client.close();
  });

  it("excludes gated media from public tag counts", async () => {
    const tags = await listTags();

    expect(tags.find((tag) => tag.slug === "animals")?.mediaCount).toBe(1);
  });

  it("keeps gated media in its members-only collection count", async () => {
    const tag = await getTagBySlug("members");

    expect(tag?.mediaCount).toBe(1);
  });
});
