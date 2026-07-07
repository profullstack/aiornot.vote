import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { getClient } from "./src/client";
import { ids } from "./src/ids";
import { DEFAULT_TAGS } from "./src/index";

config({ path: join(process.cwd(), ".env") });
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

async function main() {
  const client = getClient();
  let created = 0;
  for (const tag of DEFAULT_TAGS) {
    const existing = await client.execute({
      sql: "SELECT id FROM tags WHERE slug = ?",
      args: [tag.slug],
    });
    if (existing.rows.length > 0) continue;
    await client.execute({
      sql: `INSERT INTO tags (id, slug, name, is_default, is_visible, is_answer_spoiler)
            VALUES (?, ?, ?, 1, ?, ?)`,
      args: [
        ids.tag(),
        tag.slug,
        tag.name,
        tag.isAnswerSpoiler ? 0 : 1,
        tag.isAnswerSpoiler ? 1 : 0,
      ],
    });
    created++;
  }
  console.log(`Seeded ${created} default tag(s) (${DEFAULT_TAGS.length} total defined).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Tag seed failed:", err);
  process.exit(1);
});
