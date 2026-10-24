import { afterEach, describe, expect, it, vi } from "vitest";

const productionReadiness = vi.fn();
vi.mock("@/lib/production-readiness", () => ({
  productionReadiness: () => productionReadiness(),
}));

const { GET } = await import("@/app/api/health/route");

afterEach(() => {
  vi.clearAllMocks();
});

describe("health", () => {
  it("reports which admission door is open", async () => {
    // The rollout runbook has the operator verify this field after setting
    // LOCUS_SELF_SERVE. Only the exact word `open` counts, and a rejected value
    // leaves an invite-only deployment with nothing anywhere to say so - this
    // field is the only way to tell the two apart from outside.
    productionReadiness.mockResolvedValue({
      ready: true,
      admission: "self_serve",
      missing: [],
      alerting: "webhook",
    });

    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      readiness: { admission: "self_serve" },
    });
    expect(response.status).toBe(200);
  });

  it("stays uncached so an operator never reads a stale readiness answer", async () => {
    productionReadiness.mockResolvedValue({
      ready: false,
      admission: "invite_only",
      missing: ["alerting"],
      alerting: "structured_logs_only",
    });

    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.status).toBe(503);
  });

  it("never puts an environment value in the response", async () => {
    productionReadiness.mockResolvedValue({
      ready: true,
      admission: "invite_only",
      missing: [],
      alerting: "webhook",
    });

    const body = JSON.stringify(await (await GET()).json());
    // Readiness names what is missing, never what is configured. A health
    // endpoint is unauthenticated, so a key echoed here is a key published.
    expect(body).not.toMatch(/sk_|pk_|sb_secret|SUPABASE_SERVICE_ROLE_KEY/);
  });
});
