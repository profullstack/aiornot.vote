const DAY_MS = 86400_000;

/** True while the pass time is in the future. Unparseable or empty means no pass. */
export function hasLibraryPass(until: string | null | undefined, now = Date.now()): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > now;
}

/**
 * The new pass end after buying `days` more: added to the current end while it
 * is still running, otherwise to now.
 */
export function extendLibraryPass(until: string | null | undefined, days: number, now = Date.now()): string {
  const cur = until ? Date.parse(until) : NaN;
  const from = Number.isFinite(cur) && cur > now ? cur : now;
  return new Date(from + days * DAY_MS).toISOString();
}

/** Whole days left on a pass, rounded up (0 once it has ended). */
export function libraryPassDaysLeft(until: string | null | undefined, now = Date.now()): number {
  if (!hasLibraryPass(until, now)) return 0;
  return Math.ceil((Date.parse(until as string) - now) / DAY_MS);
}
