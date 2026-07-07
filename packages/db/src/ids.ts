import { randomUUID } from "node:crypto";

/**
 * Prefixed, sortable-ish ids. We keep it simple: a short prefix + a uuid.
 * These are opaque TEXT primary keys used across the schema.
 */
export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}

export const ids = {
  user: () => newId("usr"),
  session: () => newId("ses"),
  verification: () => newId("evt"),
  media: () => newId("med"),
  tag: () => newId("tag"),
  guess: () => newId("gss"),
  submission: () => newId("sub"),
  seedBatch: () => newId("bat"),
  audit: () => newId("aud"),
};
