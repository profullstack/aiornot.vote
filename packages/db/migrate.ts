import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "dotenv";
import { getClient, isPostgres } from "./src/client";

// Load env from the repo root and the package dir (repo root wins if both exist).
config({ path: join(process.cwd(), ".env") });
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../../.env") });

async function main() {
  const client = getClient();
  // Two editions: migrations/ (SQLite) and migrations-pg/ (Postgres). The
  // Postgres directory starts from 0000_init.sql, the whole schema as it stood
  // when the data left Turso (generated with `npx libsql-pg convert-schema`),
  // and its _migrations table was copied across with the data, so the SQLite
  // history reads as applied there. Add every new migration to both.
  const migrationsDir = join(__dirname, isPostgres(client) ? "migrations-pg" : "migrations");

  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );

  const applied = new Set(
    (await client.execute("SELECT name FROM _migrations")).rows.map(
      (r) => r.name as string,
    ),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = readFileSync(join(migrationsDir, file), "utf8");
    // Split on semicolons at line ends; libsql executes one statement per call.
    const statements = sqlText
      .split(/;\s*(?:\n|$)/)
      // Strip full-line comments within each statement so a leading comment
      // doesn't cause the whole statement to be dropped.
      .map((s) =>
        s
          .split("\n")
          .filter((line) => !line.trim().startsWith("--"))
          .join("\n")
          .trim(),
      )
      .filter((s) => s.length > 0);

    console.log(`Applying migration ${file} (${statements.length} statements)…`);
    for (const stmt of statements) {
      await client.execute(stmt);
    }
    await client.execute({
      sql: "INSERT INTO _migrations (name) VALUES (?)",
      args: [file],
    });
    count++;
  }

  if (count === 0) {
    console.log("No pending migrations. Database is up to date.");
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
