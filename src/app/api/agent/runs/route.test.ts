import { sql } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "@/test/database";
import { seedRun } from "@/test/fixtures";

const authMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const readRunUsageMock = vi.hoisted(() => vi.fn());
const startMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
const credentialStatusMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));
vi.mock("@/lib/agent/provider-credential-store", () => ({
  cloudflareCredentialStatus: credentialStatusMock,
}));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/agent/run-usage", () => ({ readRunUsage: readRunUsageMock }));
vi.mock("workflow/api", () => ({ start: startMock }));

// The route's Admission is resolved from environment state only, so these tests
// stay about the route while still exercising the real tier, capability, and
// quota tables. The store beneath Admission has its own database tests.
vi.mock("@/lib/admission-server", async () => {
  const { admissionWithCapabilities, selfServeOpen } = await import("@/lib/admission");
  return {
    admissionForAccount: async (userId: string | null) =>
      admissionWithCapabilities({
        userId,
        partnerUserIds: process.env.ALPHA_ALLOWED_USER_IDS,
        subscriptionActive: false,
        // Read from the environment rather than pinned, so a test can open
        // self-serve the way a deployment does.
        selfServeOpen: selfServeOpen(),
        emailVerified: true,
        selfServeCapacity: true,
      }),
  };
});

import { POST } from "@/app/api/agent/runs/route";
import { runQuotaForTier } from "@/lib/admission";
import { CONTROLLED_ALPHA_DATA_POLICY_VERSION } from "@/lib/agent/run-request";

const database = setupTestDatabase();
const PARTNER = "user_design_partner";
const PARTNER_QUOTA = runQuotaForTier("partner");

function runRequest(executionMode: "shared" | "byok" = "shared") {
  return new Request("http://localhost/api/agent/runs", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      repository: "vercel/next.js",
      baseRef: "main",
      task: "Fix the documented alpha capability guard",
      executionMode,
      acceptanceCriteria: ["The guarded route rejects users outside the alpha"],
      dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
    }),
  });
}

async function runs(userId = PARTNER) {
  return database().selectFrom("agent_runs")
    .select(["id", "status", "failure_kind", "token_budget", "execution_mode", "workflow_run_id"])
    .where("user_id", "=", userId)
    .execute();
}

async function tasks(userId = PARTNER) {
  return database().selectFrom("agent_tasks").select("id").where("user_id", "=", userId).execute();
}

async function liveLeases() {
  return database().selectFrom("agent_provider_leases").select(["run_id", "model"])
    .where("released_at", "is", null).execute();
}

async function dailyClaims() {
  return database().selectFrom("agent_provider_daily_claims").select("run_id").execute();
}

/** Takes the shared provider capacity for a Run that belongs to someone else. */
async function occupyProviderCapacity(key = "cloudflare-workers-ai:shared") {
  const runId = await seedRun(database(), "user_elsewhere", { status: "executing" });
  await sql`select * from public.acquire_agent_provider_lease(${runId}::uuid, ${key}, 1, 3600)`.execute(database());
  return runId;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  authMock.mockReset().mockResolvedValue({ userId: "user_outside_alpha" });
  consumeRateLimitMock.mockReset().mockResolvedValue({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
  // The advisory pre-check is the real query by default; tests that need it to
  // disagree with the authoritative claim override it.
  readRunUsageMock.mockReset().mockImplementation(async (userId: string) => {
    const actual = await vi.importActual<typeof import("@/lib/agent/run-usage")>("@/lib/agent/run-usage");
    return actual.readRunUsage(userId);
  });
  startMock.mockReset().mockResolvedValue({ runId: "workflow-id" });
  trackMock.mockReset();
  credentialStatusMock.mockReset().mockResolvedValue({ configured: true });
  vi.stubEnv("ALPHA_ALLOWED_USER_IDS", PARTNER);
  vi.stubEnv("LOCUS_AGENT_MODEL", "@cf/qwen/qwen3.8-27b");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "0123456789abcdef0123456789abcdef");
  vi.stubEnv("CLOUDFLARE_API_TOKEN", "cloudflare-token-that-is-long-enough");
});

describe("controlled-alpha Agent Run starts", () => {
  it("rejects authenticated users outside the design-partner allowlist", async () => {
    const response = await POST(runRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent Runs are limited to invited design partners during early access.",
    });
    expect(await runs("user_outside_alpha")).toEqual([]);
  });

  it("enforces durable start throttling for an invited user", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 37 });

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
    expect(await runs()).toEqual([]);
  });

  it("admits any signed-in user only when self-serve admission is open, at the free quota", async () => {
    // The free-beta branch expressed this as LOCUS_PUBLIC_BETA_ENABLED=true.
    // Admission carries the same intent with per-tier quota, a verified-email
    // barrier, and an account ceiling, and it accepts only the exact word `open`.
    vi.stubEnv("LOCUS_SELF_SERVE", "open");

    const first = await POST(runRequest());
    expect(first.status).toBe(202);
    expect(await runs("user_outside_alpha")).toMatchObject([{ status: "queued" }]);

    // The free tier allows one active Run. The second start is refused by the
    // quota, not by admission.
    const second = await POST(runRequest("byok"));
    expect(second.status).toBe(429);
    expect(await runs("user_outside_alpha")).toHaveLength(1);
  });

  it("records versioned data-policy evidence before starting the workflow", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    let stepsWhenWorkflowStarted: unknown[] = [];
    startMock.mockImplementationOnce(async () => {
      stepsWhenWorkflowStarted = await database().selectFrom("agent_steps")
        .select(["sequence", "kind", "detail"]).execute();
      return { runId: "workflow-id" };
    });

    const response = await POST(runRequest());

    expect(response.status).toBe(202);
    expect(stepsWhenWorkflowStarted).toEqual([{
      sequence: 0,
      kind: "approval",
      detail: expect.objectContaining({
        policyVersion: CONTROLLED_ALPHA_DATA_POLICY_VERSION,
        acceptedAt: expect.any(String),
      }),
    }]);
    const [run] = await runs();
    expect(run).toMatchObject({ status: "queued", workflow_run_id: "workflow-id", execution_mode: "shared", token_budget: 100_000 });
    expect(await response.json()).toMatchObject({ run: { id: run.id, workflow_run_id: "workflow-id" } });
    expect(trackMock).toHaveBeenCalledWith({
      event: "agent_run_started",
      userId: PARTNER,
      properties: { workflowCorrelated: true },
    });
  });

  // R12: the advisory count-then-insert let concurrent requests all pass. The
  // authoritative decision is the claim, so a denial from it must be honoured
  // even though the pre-check above said there was room.
  it("refuses the Run when the atomic claim denies it despite the pre-check passing", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    readRunUsageMock.mockResolvedValue({ activeRuns: 0, runsInLast24Hours: 0 });
    for (let index = 0; index < PARTNER_QUOTA.maxActiveRuns; index += 1) {
      await seedRun(database(), PARTNER, { status: "executing" });
    }

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    // No new Run, no orphaned task, no provider lease, and no workflow.
    expect(await runs()).toHaveLength(PARTNER_QUOTA.maxActiveRuns);
    expect(await tasks()).toHaveLength(PARTNER_QUOTA.maxActiveRuns);
    expect(await liveLeases()).toEqual([]);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("reports the daily limit with its own retry window", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    readRunUsageMock.mockResolvedValue({ activeRuns: 0, runsInLast24Hours: 0 });
    for (let index = 0; index < PARTNER_QUOTA.maxRunsPerRolling24Hours; index += 1) {
      await seedRun(database(), PARTNER, { status: "completed" });
    }

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
  });

  it("fails closed when the claim itself errors", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    await sql`drop function public.claim_agent_run_slot`.execute(database());

    const response = await POST(runRequest());

    // 503 rather than 429: the quota was never decided, so telling the caller to
    // retry after a quota window would be a guess.
    expect(response.status).toBe(503);
    expect(await tasks()).toEqual([]);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("fails closed when an allowed claim carries no run id", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    await sql`
      create or replace function public.claim_agent_run_slot(
        p_user_id text, p_task_id uuid, p_model text, p_token_budget integer, p_active_statuses text[],
        p_max_active integer, p_max_daily integer, p_provider text, p_execution_mode text
      ) returns table (allowed boolean, reason text, run_id uuid)
      language sql as $$ select true, null::text, null::uuid $$
    `.execute(database());

    const response = await POST(runRequest());

    expect(response.status).toBe(500);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("fails closed when free-tier provider capacity is reserved by another Run", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    const holder = await occupyProviderCapacity();

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(3_500);
    expect(await runs()).toMatchObject([{ status: "failed", failure_kind: "quota_exhausted" }]);
    expect(await liveLeases()).toEqual([{ run_id: holder, model: "cloudflare-workers-ai:shared" }]);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("refuses a shared Run after the UTC daily provider allowance is claimed", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    const earlier = await seedRun(database(), "user_elsewhere", { status: "completed" });
    await sql`select * from public.claim_agent_provider_daily_slot(${earlier}::uuid, 'cloudflare-workers-ai', 1)`
      .execute(database());

    const response = await POST(runRequest("shared"));

    expect(response.status).toBe(429);
    const retryAfter = Number(response.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(86_400);
    expect(await runs()).toMatchObject([{ status: "failed", failure_kind: "quota_exhausted" }]);
    // The provider lease taken a moment earlier is handed back.
    expect(await liveLeases()).toEqual([]);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("uses an owner's reviewed connection without spending the shared daily slot", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    // Shared capacity is busy; a BYOK Run has its own lane.
    await occupyProviderCapacity();

    const response = await POST(runRequest("byok"));

    expect(response.status).toBe(202);
    expect(credentialStatusMock).toHaveBeenCalledWith(PARTNER);
    const [run] = await runs();
    expect(run).toMatchObject({ execution_mode: "byok", token_budget: 180_000 });
    expect(await dailyClaims()).toEqual([]);
    expect(await liveLeases()).toContainEqual({ run_id: run.id, model: `cloudflare-workers-ai:byok:${PARTNER}` });
  });

  it("fails closed when data-policy evidence cannot be recorded", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    await sql`drop table public.agent_steps cascade`.execute(database());

    const response = await POST(runRequest());

    expect(response.status).toBe(503);
    expect(startMock).not.toHaveBeenCalled();
    expect(await runs()).toMatchObject([{ status: "failed" }]);
    expect(await liveLeases()).toEqual([]);
  });

  it("fails closed before persistence when the deployment token budget is invalid", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    vi.stubEnv("LOCUS_RUN_TOKEN_BUDGET", "unbounded");

    const response = await POST(runRequest());

    expect(response.status).toBe(503);
    expect(await tasks()).toEqual([]);
  });

  it("keeps a successfully started workflow alive when correlation persistence fails", async () => {
    authMock.mockResolvedValue({ userId: PARTNER });
    // Workflow ids are unique, so recording one already on another Run fails.
    await seedRun(database(), "user_elsewhere", { status: "completed", workflow_run_id: "workflow-id" });

    const response = await POST(runRequest());

    expect(response.status).toBe(202);
    expect(await runs()).toMatchObject([{ status: "queued", workflow_run_id: null }]);
    expect(trackMock).toHaveBeenCalledWith(expect.objectContaining({ properties: { workflowCorrelated: false } }));
  });
});
