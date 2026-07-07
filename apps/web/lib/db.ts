import "server-only";
import { getDb, getClient } from "@aiornot/db";

export { getDb, getClient };
export * as schema from "@aiornot/db/schema";
export const db = getDb();
export const sqlClient = getClient();
