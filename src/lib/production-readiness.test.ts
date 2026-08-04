import { describe, expect, it } from "vitest";

import { productionReadiness } from "@/lib/production-readiness";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_value",
  CLERK_SECRET_KEY: "sk_test_value",
  ALPHA_ALLOWED_USER_IDS: "user_partner",
  LOCUS_AGENT_MODEL: "google/gemini-3.5-flash",
  GOOGLE_GENERATIVE_AI_API_KEY: "google-secret",
  CRON_SECRET: "cron-secret",
  OPS_ALERT_WEBHOOK_URL: "https://alerts.example/locus",
};

describe("production readiness", () => {
  it("reports the runtime ready without exposing environment values", () => {
    expect(productionReadiness(complete)).toEqual({
      ready: true,
      missing: [],
      alerting: "webhook",
    });
  });

  it("fails closed for missing retention or provider configuration", () => {
    const incomplete = { ...complete, CRON_SECRET: "", GOOGLE_GENERATIVE_AI_API_KEY: "" };
    expect(productionReadiness(incomplete)).toEqual({
      ready: false,
      missing: ["agent_provider", "retention_cron"],
      alerting: "webhook",
    });
  });

  it("makes logs-only alerting visible without exposing its destination", () => {
    expect(productionReadiness({ ...complete, OPS_ALERT_WEBHOOK_URL: "" })).toMatchObject({
      ready: true,
      alerting: "structured_logs_only",
    });
  });
});
