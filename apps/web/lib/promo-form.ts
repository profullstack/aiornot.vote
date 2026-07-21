function parseDecimalInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function normalizePromoPercentOff(value: unknown): number {
  const parsed = parseDecimalInteger(String(value ?? "100"));
  if (parsed == null) return 100;
  return Math.min(100, Math.max(1, parsed));
}

export function normalizePromoMaxUses(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const parsed = parseDecimalInteger(raw);
  if (parsed == null) return null;
  return Math.max(1, parsed);
}
