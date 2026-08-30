import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const warnMock = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: { warn: warnMock },
}));

describe("analytics delivery visibility", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    warnMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("logs a structured warning when the analytics sink rejects an insert", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { track } = await import("@/lib/analytics");

    await track({
      event: "alpha_access_requested",
      properties: { result: "new" },
    });

    expect(warnMock).toHaveBeenCalledWith("analytics_insert_failed", {
      event: "alpha_access_requested",
      status: 503,
    });
    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps analytics non-blocking while exposing network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { track } = await import("@/lib/analytics");

    await expect(track({
      event: "alpha_access_requested",
      properties: { result: "existing" },
    })).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith("analytics_insert_failed", {
      event: "alpha_access_requested",
      status: "network_error",
    });
  });
});
