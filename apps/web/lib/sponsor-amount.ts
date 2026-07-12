export const MIN_SPONSOR_USD = 5;

export function normalizeSponsorAmountUsd(
  value: unknown,
): { ok: true; amount: number } | { ok: false; error: string } {
  const amount = Math.round(Number(value) * 100) / 100;
  if (!Number.isFinite(amount)) {
    return { ok: false, error: "Enter a valid sponsorship amount." };
  }
  if (amount < MIN_SPONSOR_USD) {
    return { ok: false, error: `Minimum sponsorship is $${MIN_SPONSOR_USD}.` };
  }
  return { ok: true, amount };
}
