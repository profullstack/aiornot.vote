import { describe, expect, it } from "vitest";
import { hasSubmitEntitlement } from "./access";

describe("hasSubmitEntitlement", () => {
  it("does not grant submit access to a regular verified player", () => {
    expect(hasSubmitEntitlement({ isMember: false, hasPlayPass: false })).toBe(false);
  });

  it("grants submit access to play-pass holders", () => {
    expect(hasSubmitEntitlement({ isMember: false, hasPlayPass: true })).toBe(true);
  });

  it("grants submit access to lifetime members", () => {
    expect(hasSubmitEntitlement({ isMember: true, hasPlayPass: false })).toBe(true);
  });
});
