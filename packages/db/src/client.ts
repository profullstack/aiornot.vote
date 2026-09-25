import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import type { Client } from "@libsql/client";
import { createClient as createPostgresClient } from "@profullstack/libsql-pg";
import * as schema from "./schema";

let _client: Client | null = null;
const POSTGRES_URL = /^postgres(ql)?:\/\//i;
const require_ = createRequire(import.meta.url);

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

/**
 * The database URL: `DATABASE_URL=postgres://...` in production (the shared
 * Postgres cluster on dev2) or a `file:` path for local runs and the tests
 * (default `file:./local.db`, anchored to the workspace root so the same
 * local.db is used no matter which package's cwd runs the process).
 * `TURSO_DATABASE_URL` is still read as a fallback name for a `file:` URL; a
 * `libsql://` value is refused, because the data left Turso for Postgres in
 * 2026-09.
 */
export function resolveUrl(): string {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./local.db";
  if (POSTGRES_URL.test(url)) return url;
  if (url.startsWith("file:")) {
    const rest = url.slice("file:".length);
    if (!rest.startsWith("/")) {
      const abs = resolve(workspaceRoot(), rest.replace(/^\.\//, ""));
      return `file:${abs}`;
    }
    return url;
  }
  throw new Error(
    `DATABASE_URL must be a postgres:// URL (production) or a file: path (local); got "${url.split(":")[0]}:". ` +
      "Turso/libsql:// is no longer supported: the data lives in Postgres now.",
  );
}

/** True when the client talks to Postgres (through @profullstack/libsql-pg). */
export function isPostgres(client: Client): boolean {
  return (client as { protocol?: string }).protocol === "postgres";
}

/**
 * The process-wide client. Postgres goes through @profullstack/libsql-pg, which
 * keeps the @libsql/client surface every query was written against (execute,
 * batch, transaction) and rewrites the SQLite idioms per statement. A `file:`
 * URL loads @libsql/client lazily: it is a devDependency, so the production
 * image needs neither it nor its native binding.
 */
export function getClient(): Client {
  if (_client) return _client;
  const url = resolveUrl();
  if (POSTGRES_URL.test(url)) {
    _client = createPostgresClient({ url }) as unknown as Client;
  } else {
    const { createClient } = require_("@libsql/client") as typeof import("@libsql/client");
    _client = createClient({ url });
  }
  return _client;
}

export { schema };
