import { sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { SCHEMA_VERSION } from "@/lib/db/schema";
import { probeDatabase, productionReadiness, schemaIsCurrent } from "@/lib/production-readiness";
import { createTestDatabase, type TestDatabase } from "@/test/database";

const complete = {
  DATABASE_URL: "postgresql://locus@db.example/locus",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_value",
  CLERK_SECRET_KEY: "sk_test_value",
  ALPHA_ALLOWED_USER_IDS: "user_partner",
  LOCUS_AGENT_MODEL: "@cf/qwen/qwen3.8-27b",
  CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
  CLOUDFLARE_API_TOKEN: "cloudflare-token-that-is-long-enough",
  LOCUS_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  CRON_SECRET: "cron-secret",
  OPS_ALERT_WEBHOOK_URL: "https://alerts.example/locus",
};

const databaseReady = async () => true;

describe("production readiness", () => {
  it("reports the runtime ready without exposing environment values", async () => {
    await expect(productionReadiness(complete, databaseReady)).resolves.toEqual({
      ready: true,
      admission: "invite_only",
      missing: [],
      alerting: "webhook",
    });
  });

  it("fails closed for missing retention or provider configuration", async () => {
    const incomplete = { ...complete, CRON_SECRET: "", LOCUS_AGENT_MODEL: "" };
    await expect(productionReadiness(incomplete, databaseReady)).resolves.toEqual({
      ready: false,
      admission: "invite_only",
      missing: ["agent_provider", "retention_cron"],
      alerting: "webhook",
    });
  });

  it("fails closed for an unreviewed Agent model", async () => {
    await expect(productionReadiness({
      ...complete,
      LOCUS_AGENT_MODEL: "google/gemini-3.5-flash",
    }, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["agent_provider"],
    });
  });

  it("fails closed when shared Cloudflare authentication is unavailable", async () => {
    await expect(productionReadiness({
      ...complete,
      CLOUDFLARE_API_TOKEN: "",
    }, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["agent_provider"],
    });
  });

  it("accepts self-serve admission without an invite list", async () => {
    await expect(productionReadiness({
      ...complete,
      ALPHA_ALLOWED_USER_IDS: "",
      LOCUS_SELF_SERVE: "open",
    }, databaseReady)).resolves.toMatchObject({
      ready: true,
      missing: [],
    });
  });

  it("requires a valid credential-encryption key before BYOK is exposed", async () => {
    await expect(productionReadiness({
      ...complete,
      LOCUS_CREDENTIAL_ENCRYPTION_KEY: "not-a-32-byte-key",
    }, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["agent_provider"],
    });
  });

  it("reports the database missing when the probe fails", async () => {
    await expect(productionReadiness(complete, async () => false)).resolves.toMatchObject({
      ready: false,
      missing: ["database"],
    });
  });

  it("fails closed when logs are the only alerting channel", async () => {
    await expect(productionReadiness(
      { ...complete, OPS_ALERT_WEBHOOK_URL: "" },
      databaseReady,
    )).resolves.toMatchObject({
      ready: false,
      missing: ["alerting"],
      alerting: "structured_logs_only",
    });
  });

  it("accepts the independent GitHub Actions production health check", async () => {
    await expect(productionReadiness(
      { ...complete, OPS_ALERT_WEBHOOK_URL: "", OPS_EXTERNAL_HEALTHCHECK: "github_actions" },
      databaseReady,
    )).resolves.toMatchObject({
      ready: true,
      missing: [],
      alerting: "external_health_check",
    });
  });
});

describe("run admission readiness", () => {
  it("is unready when neither the allowlist nor self-serve admits anyone", async () => {
    const result = await productionReadiness(
      { ...complete, ALPHA_ALLOWED_USER_IDS: "" },
      databaseReady,
    );
    expect(result.missing).toContain("run_admission");
    expect(result.admission).toBe("invite_only");
  });

  it("is ready on an empty allowlist once self-serve is open", async () => {
    // An empty allowlist used to mean nobody could start a Run. With self-serve
    // open it is the normal state of a public deployment, and reporting that as
    // unready would train an operator to ignore the signal.
    const result = await productionReadiness(
      { ...complete, ALPHA_ALLOWED_USER_IDS: "", LOCUS_SELF_SERVE: "open" },
      databaseReady,
    );
    expect(result.missing).not.toContain("run_admission");
    expect(result.admission).toBe("self_serve");
  });

  it("reports which door is open so an operator can see it without guessing", async () => {
    const invited = await productionReadiness(complete, databaseReady);
    expect(invited.admission).toBe("invite_only");
  });
});

describe("database readiness", () => {
  let database: TestDatabase | undefined;

  afterEach(async () => {
    await database?.destroy();
    database = undefined;
  });

  it("fails closed without a connection string, before trying to connect", async () => {
    await expect(probeDatabase({ ...complete, DATABASE_URL: "" })).resolves.toBe(false);
    await expect(probeDatabase({ ...complete, DATABASE_URL: "   " })).resolves.toBe(false);
  });

  it("is ready when the newest migration this build knows about is recorded", async () => {
    database = await createTestDatabase();

    await expect(schemaIsCurrent(database)).resolves.toBe(true);
  });

  it("is unready when the database is behind this build", async () => {
    database = await createTestDatabase();
    await sql`delete from public.schema_migrations where name = ${SCHEMA_VERSION}`.execute(database);

    await expect(schemaIsCurrent(database)).resolves.toBe(false);
  });

  it("is unready, not crashing, when the ledger itself is missing", async () => {
    database = await createTestDatabase();
    await sql`drop table public.schema_migrations`.execute(database);

    await expect(schemaIsCurrent(database)).resolves.toBe(false);
  });
});
