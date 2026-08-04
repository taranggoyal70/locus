import { describe, expect, it, vi } from "vitest";

import { sendOperationalAlert } from "@/lib/agent/operations";

describe("Agent Run operational alerts", () => {
  it("delivers a bounded, source-free payload to an HTTPS webhook", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(sendOperationalAlert({
      event: "agent.run.failed",
      runId: "00000000-0000-4000-8000-000000000001",
      failureKind: "quota_exhausted",
    }, { OPS_ALERT_WEBHOOK_URL: "https://alerts.example/hooks/locus" }, fetcher)).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledWith(
      "https://alerts.example/hooks/locus",
      expect.objectContaining({ method: "POST", redirect: "error" }),
    );
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload).toEqual({
      event: "agent.run.failed",
      runId: "00000000-0000-4000-8000-000000000001",
      failureKind: "quota_exhausted",
    });
  });

  it("does not make a request when alerting is unconfigured or unsafe", async () => {
    const fetcher = vi.fn();
    await expect(sendOperationalAlert({
      event: "agent.run.failed",
      runId: "run-id",
      failureKind: "workflow_error",
    }, {}, fetcher)).resolves.toBe(false);
    await expect(sendOperationalAlert({
      event: "agent.run.failed",
      runId: "run-id",
      failureKind: "workflow_error",
    }, { OPS_ALERT_WEBHOOK_URL: "http://localhost/hook" }, fetcher)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
