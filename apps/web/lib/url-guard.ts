/**
 * Basic SSRF guard for user-provided media URLs. Blocks non-http(s) schemes and
 * obvious private / internal hosts. DNS-rebinding is out of scope for the MVP.
 */
export function validateExternalUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Enter a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are allowed." };
  }
  const host = url.hostname.toLowerCase().replace(/^\[(.*)\]$/, "$1");
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^0\./.test(host) ||          // 0.0.0.0/8 — "this" network (RFC 1122)
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||   // link-local (RFC 3927)
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) || // 100.64.0.0/10 — shared address space (RFC 6598)
    /^(fc|fd)[0-9a-f]{2}:/.test(host) || // fc00::/7 — IPv6 ULA (RFC 4193)
    /^fe[89ab][0-9a-f]:/.test(host)       // fe80::/10 — IPv6 link-local (RFC 4291)
  ) {
    return { ok: false, error: "That host is not allowed." };
  }
  return { ok: true, url };
}

export function domainOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
