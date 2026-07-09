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
  it("blocks IPv4-mapped IPv6 private literals", () => {
    expect(validateExternalUrl("http://[::ffff:127.0.0.1]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[::ffff:10.0.0.5]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[::ffff:192.168.1.1]/x").ok).toBe(false);
    expect(validateExternalUrl("http://[::ffff:169.254.169.254]/x").ok).toBe(false);
  });
  it("allows IPv4-mapped IPv6 public literals", () => {
    expect(validateExternalUrl("http://[::ffff:93.184.216.34]/x").ok).toBe(true);
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
