import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

// pwamart.com's inspector requires: a manifest, a name, display, and 192/512 PNG icons.
describe("web app manifest", () => {
  const m = manifest();

  it("is installable", () => {
    expect(m).toMatchObject({ name: "AIorNot.vote", start_url: "/", scope: "/", display: "standalone" });
    for (const size of ["192x192", "512x512"]) {
      expect(m.icons?.some((icon) => icon.sizes === size && icon.type === "image/png")).toBe(true);
    }
  });

  it("points at PNGs of the declared size that exist in public/", () => {
    for (const icon of m.icons ?? []) {
      const file = join(__dirname, "..", "public", icon.src);
      expect(existsSync(file)).toBe(true);
      const png = readFileSync(file);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      const [w, h] = (icon.sizes ?? "").split("x").map(Number);
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w, h]);
    }
  });
});
