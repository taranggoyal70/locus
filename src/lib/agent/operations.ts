import type { AgentFailureKind } from "@/lib/agent/run-budget";
import { logger } from "@/lib/logger";

type OperationalAlert = {
  event: "agent.run.failed" | "agent.run.quota_warning";
  runId: string;
  failureKind: AgentFailureKind;
};

function safeWebhook(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function sendOperationalAlert(
  alert: OperationalAlert,
  environment: { OPS_ALERT_WEBHOOK_URL?: string } = {
    OPS_ALERT_WEBHOOK_URL: process.env["OPS_ALERT_WEBHOOK_URL"],
  },
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const webhook = safeWebhook(environment.OPS_ALERT_WEBHOOK_URL);
  if (!webhook) {
    logger.warn("agent.alert.not_configured", { failureKind: alert.failureKind }, alert.runId);
    return false;
  }
  try {
    const response = await fetcher(webhook, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      logger.error(
        "agent.alert.delivery_failed",
        { status: response.status, failureKind: alert.failureKind },
        alert.runId,
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.error(
      "agent.alert.delivery_failed",
      { name: error instanceof Error ? error.name : "UnknownError" },
      alert.runId,
    );
    return false;
  }
}
