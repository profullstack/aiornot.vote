import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the `@/*` path mapping in tsconfig.json. Without it, any test that
  // imports a route handler fails to resolve, which is why route coverage used
  // to stop at the handlers that happened to use relative imports.
  resolve: {
    alias: [{ find: /^@\/(.*)$/, replacement: `${fileURLToPath(new URL(".", import.meta.url))}$1` }],
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
