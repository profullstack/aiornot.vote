import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

/** Walk up from cwd to the workspace root (dir containing pnpm-workspace.yaml). */
function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function resolveUrl(): string {
  const url = process.env.TURSO_DATABASE_URL || "file:./local.db";
  // Anchor relative file: URLs to the workspace root so the same local.db is
  // used no matter which package's cwd runs the process (server vs. seed CLI).
  if (url.startsWith("file:")) {
    const rest = url.slice("file:".length);
    if (!rest.startsWith("/")) {
      const abs = resolve(workspaceRoot(), rest.replace(/^\.\//, ""));
      return `file:${abs}`;
    }
  }
  return url;
}

export function getClient(): Client {
  if (_client) return _client;
  _client = createClient({
    url: resolveUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  return _client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (_db) return _db;
  _db = drizzle(getClient(), { schema });
  return _db;
}

export { schema };
