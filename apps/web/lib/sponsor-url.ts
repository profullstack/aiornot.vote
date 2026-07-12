import { validateExternalUrl } from "./url-guard";

export type SponsorUrlResult =
  | { ok: true; url: string | null }
  | { ok: false; error: string };

export function normalizeSponsorUrl(raw: string | null | undefined): SponsorUrlResult {
  const trimmed = raw?.trim();
  if (!trimmed) return { ok: true, url: null };
  if (trimmed.length > 2048) {
    return { ok: false, error: "Sponsor link is too long." };
  }

  const externalUrl = validateExternalUrl(trimmed);
  if (!externalUrl.ok) {
    if (externalUrl.error === "Only http and https URLs are allowed.") {
      return { ok: false, error: "Sponsor link must start with http:// or https://." };
    }
    if (externalUrl.error === "Enter a valid URL.") {
      return { ok: false, error: "Sponsor link must be a valid URL." };
    }
    return { ok: false, error: "Sponsor link host is not allowed." };
  }

  return { ok: true, url: externalUrl.url.toString() };
}
