export function normalizePage(value: unknown, fallback = 1): number {
  const parsed = parsePageInteger(value);
  if (parsed === null) return fallback;

  return parsed >= 1 ? parsed : fallback;
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function parsePageInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
