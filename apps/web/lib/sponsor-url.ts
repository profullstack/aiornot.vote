export type SponsorUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

export function normalizeSponsorUrl(raw: string | null | undefined): SponsorUrlResult {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, url: null };
  if (trimmed.length > 2048) {
    return { ok: false, error: "Sponsor link is too long." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Sponsor link must be a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Sponsor link must start with http:// or https://." };
  }

  return { ok: true, url: parsed.toString() };
}
