import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    // Builds the migrated test database once per run; see src/test/database.ts.
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // Database tests boot an in-process PostgreSQL per test. Alone that takes
    // well under a second, but with every file running in parallel the CPU is
    // shared and the 5s default turns ordinary contention into flaky failures.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
