export function normalizePage(value: unknown, fallback = 1): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;

  const page = Math.floor(parsed);
  return page >= 1 ? page : fallback;
}
