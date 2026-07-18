type BoundedIntegerOptions = {
  fallback: number;
  min: number;
  max: number;
};

export function readBoundedInteger(value: unknown, options: BoundedIntegerOptions): number {
  const parsed = parseInteger(value);
  if (parsed === null) return options.fallback;
  return Math.min(options.max, Math.max(options.min, parsed));
}

function parseInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
