import type { Json } from "@/lib/database.types";
import type { ClientAnalyticsEvent } from "@/lib/analytics-events";
import { logger } from "@/lib/logger";

type ClientEventPayload = {
  event: ClientAnalyticsEvent;
  userId: string;
  properties: Record<string, Json>;
};

export type AnalyticsEventPayload =
  | ClientEventPayload
  | {
      event: "alpha_access_requested";
      properties: { result: "new" | "existing" };
    }
  | {
      event: "agent_run_started";
      userId: string;
      properties: { workflowCorrelated: boolean };
    }
  | {
      // The Admission decision for a signed-in request. This is the funnel: how
      // many accounts are held on the waitlist, how many the free tier admits,
      // and how many are refused. None of it was observable before, so "should
      // we open self-serve wider?" had no evidence behind it.
      //
      // The tier and the reason are closed enumerations the server produced. No
      // user text is involved, so nothing here can carry what someone typed.
      event: "admission_resolved";
      userId: string;
      properties: { tier: string; reason: string };
    }
  | {
      event: "repo_loaded";
      userId: string;
      properties: {
        files: number;
        truncated: boolean;
        cached: boolean;
      };
    }
  | {
      event: "api_locate";
      userId: string;
      properties: {
        taskShape: string;
        taskCharacters: number;
        sliceFiles: number;
        widened: boolean;
        includedTokens: number;
        totalTokens: number;
      };
    };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANALYTICS_TIMEOUT_MS = 1_500;

export async function track(payload: AnalyticsEventPayload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  const { event, properties } = payload;
  const userId = "userId" in payload ? payload.userId : undefined;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event,
        user_id: userId ?? null,
        properties,
      }),
      signal: AbortSignal.timeout(ANALYTICS_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn("analytics_insert_failed", {
        event,
        status: response.status,
      });
    }
  } catch {
    logger.warn("analytics_insert_failed", { event, status: "network_error" });
  }
}
