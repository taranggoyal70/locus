import { describe, expect, it, vi } from "vitest";

import { productionReadiness } from "@/lib/production-readiness";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_value_that_is_long_enough",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_value_that_is_long_enough",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_value",
  CLERK_SECRET_KEY: "sk_test_value",
  ALPHA_ALLOWED_USER_IDS: "user_partner",
  LOCUS_AGENT_MODEL: "google/gemini-3.5-flash",
  GOOGLE_GENERATIVE_AI_API_KEY: "google-secret",
  CRON_SECRET: "cron-secret",
  OPS_ALERT_WEBHOOK_URL: "https://alerts.example/locus",
};

const databaseReady = vi.fn(async () => new Response(null, { status: 200 }));

function recordingProbe() {
  return vi.fn(async (input: string | URL, init?: RequestInit) => {
    void input;
    void init;
    return new Response(null, { status: 200 });
  });
}

function legacyKey(role: "anon" | "service_role", ref = "project") {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ iss: "supabase", ref, role })).toString("base64url");
  return `${header}.${payload}.${"x".repeat(64)}`;
}

describe("production readiness", () => {
  it("reports the runtime ready without exposing environment values", async () => {
    await expect(productionReadiness(complete, databaseReady)).resolves.toEqual({
      ready: true,
      missing: [],
      alerting: "webhook",
    });
  });

  it("fails closed for missing retention or provider configuration", async () => {
    const incomplete = { ...complete, CRON_SECRET: "", GOOGLE_GENERATIVE_AI_API_KEY: "" };
    await expect(productionReadiness(incomplete, databaseReady)).resolves.toEqual({
      ready: false,
      missing: ["agent_provider", "retention_cron"],
      alerting: "webhook",
    });
  });

  it.each([
    { name: "an invalid Supabase URL", environment: { ...complete, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" } },
    { name: "a non-Supabase database URL", environment: { ...complete, NEXT_PUBLIC_SUPABASE_URL: "https://database.example.com" } },
    { name: "a missing browser key", environment: { ...complete, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" } },
    { name: "a placeholder browser key", environment: { ...complete, NEXT_PUBLIC_SUPABASE_ANON_KEY: "***********" } },
    { name: "a placeholder service key", environment: { ...complete, SUPABASE_SERVICE_ROLE_KEY: "***********" } },
  ])("fails closed for $name", async ({ environment }) => {
    await expect(productionReadiness(environment, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["database"],
    });
  });

  it("rejects swapped legacy Supabase roles before probing the backend", async () => {
    const probe = vi.fn(async () => new Response(null, { status: 200 }));

    await expect(productionReadiness({
      ...complete,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: legacyKey("service_role"),
      SUPABASE_SERVICE_ROLE_KEY: legacyKey("anon"),
    }, probe)).resolves.toMatchObject({ ready: false, missing: ["database"] });
    expect(probe).not.toHaveBeenCalled();
  });

  it("probes modern Supabase keys only through the apikey header", async () => {
    const probe = recordingProbe();

    await productionReadiness(complete, probe);

    expect(probe.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { apikey: complete.NEXT_PUBLIC_SUPABASE_ANON_KEY },
      { apikey: complete.SUPABASE_SERVICE_ROLE_KEY },
    ]);
  });

  it("adds bearer authorization only for legacy JWT keys", async () => {
    const publicKey = legacyKey("anon");
    const serviceKey = legacyKey("service_role");
    const probe = recordingProbe();

    await productionReadiness({
      ...complete,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: publicKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    }, probe);

    expect(probe.mock.calls.map(([, init]) => init?.headers)).toEqual([
      { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
      { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    ]);
  });

  it("fails closed when Supabase rejects a well-shaped credential", async () => {
    const rejectedCredential = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));

    await expect(productionReadiness(complete, rejectedCredential)).resolves.toMatchObject({
      ready: false,
      missing: ["database"],
    });
  });

  it("makes logs-only alerting visible without exposing its destination", async () => {
    await expect(productionReadiness(
      { ...complete, OPS_ALERT_WEBHOOK_URL: "" },
      databaseReady,
    )).resolves.toMatchObject({
      ready: true,
      alerting: "structured_logs_only",
    });
  });
});
