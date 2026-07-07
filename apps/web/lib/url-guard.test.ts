import { describe, it, expect } from "vitest";
import { validateExternalUrl, domainOf } from "./url-guard";

describe("validateExternalUrl (SSRF guard)", () => {
  it("allows public https URLs", () => {
    expect(validateExternalUrl("https://example.com/photo.jpg").ok).toBe(true);
  });
  it("blocks localhost", () => {
    expect(validateExternalUrl("http://localhost/x").ok).toBe(false);
  });
  it("blocks private 10.x", () => {
    expect(validateExternalUrl("http://10.0.0.5/x").ok).toBe(false);
  });
  it("blocks link-local 169.254", () => {
    expect(validateExternalUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
  });
  it("blocks IPv6 loopback and private literals", () => {
    expect(validateExternalUrl("http://[::1]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[::]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[fd00::1]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[fe80::1]/x").ok).toBe(false);
  });
  it("blocks non-http schemes", () => {
    expect(validateExternalUrl("file:///etc/passwd").ok).toBe(false);
  });
  it("rejects garbage input", () => {
    expect(validateExternalUrl("not a url").ok).toBe(false);
  });
});

describe("domainOf", () => {
  it("strips www", () => {
    expect(domainOf("https://www.example.com/x")).toBe("example.com");
  });
  it("returns null on junk", () => {
    expect(domainOf("junk")).toBe(null);
    expect(domainOf(null)).toBe(null);
  });
});
