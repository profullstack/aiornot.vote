/**
 * Basic SSRF guard for user-provided media URLs. Blocks non-http(s) schemes and
 * obvious private / internal hosts. DNS-rebinding is out of scope for the MVP.
 */
function ipv4FromMappedIPv6(host: string): string | null {
  const match = host.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const high = Number.parseInt(match[1]!, 16);
  const low = Number.parseInt(match[2]!, 16);
  if (high > 0xffff || low > 0xffff) return null;
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

function isBlockedHost(host: string): boolean {
  const ipv4 = ipv4FromMappedIPv6(host) ?? host;
  return (
    ipv4 === "localhost" ||
    ipv4 === "0.0.0.0" ||
    ipv4 === "::1" ||
    ipv4 === "::" ||
    ipv4.endsWith(".local") ||
    ipv4.endsWith(".internal") ||
    /^127\./.test(ipv4) ||
    /^0\./.test(ipv4) ||          // 0.0.0.0/8 — "this" network (RFC 1122)
    /^10\./.test(ipv4) ||
    /^192\.168\./.test(ipv4) ||
    /^169\.254\./.test(ipv4) ||   // link-local (RFC 3927)
    /^172\.(1[6-9]|2\d|3[01])\./.test(ipv4) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ipv4) || // 100.64.0.0/10 — shared address space (RFC 6598)
    /^(fc|fd)[0-9a-f]{2}:/.test(ipv4) || // fc00::/7 — IPv6 ULA (RFC 4193)
    /^fe[89ab][0-9a-f]:/.test(ipv4)       // fe80::/10 — IPv6 link-local (RFC 4291)
  );
}

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
  if (isBlockedHost(host)) {
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
