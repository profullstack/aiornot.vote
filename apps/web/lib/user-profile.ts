import "server-only";
import { createProfileStore, type ProfileStore } from "@profullstack/profile";
import { getClient } from "./db";

/**
 * The shared Profullstack profile (@profullstack/profile) in `user_profiles`:
 * email, first and last name, company domain, job title, LinkedIn. Created on
 * first use, never at import, so `next build` opens no connection. The client
 * is libsql-pg (Postgres) in production and @libsql/client (SQLite) locally;
 * the package tells them apart by `protocol`.
 */
let store: ProfileStore | null = null;

export function profileStore(): ProfileStore {
  store ??= createProfileStore(getClient());
  return store;
}

