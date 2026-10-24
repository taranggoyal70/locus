import { describe, expect, it, vi } from "vitest";

import { productionReadiness } from "@/lib/production-readiness";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_test_value_that_is_long_enough",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test_value_that_is_long_enough",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_value",
  CLERK_SECRET_KEY: "sk_test_value",
  ALPHA_ALLOWED_USER_IDS: "user_partner",
  LOCUS_AGENT_MODEL: "openai/gpt-5.6-sol",
  AI_GATEWAY_API_KEY: "gateway-secret",
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

  it("fails closed for an unreviewed Gateway model", async () => {
    await expect(productionReadiness({
      ...complete,
      LOCUS_AGENT_MODEL: "google/gemini-3.5-flash",
    }, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["agent_provider"],
    });
  });

  it("fails closed when Gateway authentication is unavailable", async () => {
    await expect(productionReadiness({
      ...complete,
      AI_GATEWAY_API_KEY: "",
      VERCEL_OIDC_TOKEN: "",
    }, databaseReady)).resolves.toMatchObject({
      ready: false,
      missing: ["agent_provider"],
    });
  });

  it("accepts Vercel's short-lived OIDC credential", async () => {
    await expect(productionReadiness({
      ...complete,
      AI_GATEWAY_API_KEY: "",
      VERCEL_OIDC_TOKEN: "oidc-token",
    }, databaseReady)).resolves.toMatchObject({
      ready: true,
      missing: [],
    });
  });

  it("accepts Vercel's runtime when its OIDC token is platform-managed", async () => {
    await expect(productionReadiness({
      ...complete,
      AI_GATEWAY_API_KEY: "",
      VERCEL_OIDC_TOKEN: "",
      VERCEL: "1",
    }, databaseReady)).resolves.toMatchObject({
      ready: true,
      missing: [],
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

  it("validates the public key through Auth and the service key through PostgREST", async () => {
    const probe = recordingProbe();

    await productionReadiness(complete, probe);

    expect(probe.mock.calls.map(([input]) => String(input))).toEqual([
      "https://project.supabase.co/auth/v1/settings",
      "https://project.supabase.co/rest/v1/",
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
