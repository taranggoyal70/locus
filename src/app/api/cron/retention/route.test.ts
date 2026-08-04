import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));

import { GET } from "@/app/api/cron/retention/route";

describe("daily data retention job", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    serviceClientMock.mockReset();
  });

  it("fails closed when the cron secret is missing or wrong", async () => {
    expect((await GET(new Request("http://localhost/api/cron/retention"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "expected-secret");
    expect((await GET(new Request("http://localhost/api/cron/retention", {
      headers: { authorization: "Bearer wrong-secret" },
    }))).status).toBe(401);
  });

  it("runs the fixed 30-day cleanup through the service-only RPC", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const rpc = vi.fn().mockResolvedValue({
      data: [{ deleted_runs: 2, deleted_tasks: 1, deleted_events: 3, deleted_waitlist_entries: 4 }],
      error: null,
    });
    serviceClientMock.mockReturnValue({ rpc });

    const response = await GET(new Request("http://localhost/api/cron/retention", {
      headers: { authorization: "Bearer expected-secret" },
    }));

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("delete_expired_agent_data", { p_retention_days: 30 });
  });
});
