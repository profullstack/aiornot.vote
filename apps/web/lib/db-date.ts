/**
 * A timestamp as the database returns it, as a Date.
 *
 * SQLite's CURRENT_TIMESTAMP writes "YYYY-MM-DD HH:MM:SS" in UTC with no zone
 * marker; Postgres (through @profullstack/libsql-pg) returns ISO strings with
 * one. Appending "Z" blindly turned the latter into an Invalid Date, so the
 * marker is added only when it is missing.
 */
export function dbDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  const s = String(value);
  return new Date(/[zZ]$|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s.replace(" ", "T")}Z`);
}
