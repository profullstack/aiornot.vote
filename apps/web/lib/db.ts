import "server-only";
import type { Client } from "@libsql/client";
import { getDb, getClient } from "@aiornot/db";

export { getDb, getClient };
export * as schema from "@aiornot/db/schema";

/**
 * Lazy proxy so importing this module never opens a DB connection. The client
 * is created on first actual use (query time) — important during `next build`,
 * where route modules are imported before the runtime volume/DB exists.
 */
export const sqlClient: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const client = getClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
