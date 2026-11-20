import { vi } from "vitest";

// Every test file runs with the production database client swapped for the
// in-process PostgreSQL a test installs through setupTestDatabase(). A test that
// reaches the database without one fails with a message saying so, rather than
// trying to open a network connection.
vi.mock("@/lib/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/client")>();
  const { installedTestDatabase } = await import("@/test/database");
  return {
    ...actual,
    // A spy, so a test can assert a route refused a request before any query.
    db: vi.fn(() => {
      const database = installedTestDatabase();
      if (!database) throw new Error("This test reached the database; call setupTestDatabase() in its file.");
      return database;
    }),
    databaseConfigured: (environment?: Record<string, string | undefined>) =>
      environment ? actual.databaseConfigured(environment) : installedTestDatabase() !== undefined,
  };
});
