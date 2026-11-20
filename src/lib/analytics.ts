import type { ClientAnalyticsEvent } from "@/lib/analytics-events";
import { databaseConfigured, globalDb, jsonb } from "@/lib/db";
import type { Json } from "@/lib/db/schema";
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

const ANALYTICS_TIMEOUT_MS = 1_500;

/**
 * Records one product event. Analytics never fails or slows the request it
 * describes: an unconfigured database skips it, and a write that errors or takes
 * longer than ANALYTICS_TIMEOUT_MS is logged and abandoned.
 */
export async function track(payload: AnalyticsEventPayload) {
  if (!databaseConfigured()) return;

  const { event, properties } = payload;
  const userId = "userId" in payload ? payload.userId : undefined;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ANALYTICS_TIMEOUT_MS);
    });
    // Some events (a waitlist request) happen before there is an account.
    const write = globalDb("analytics events may precede an account")
      .insertInto("events")
      .values({ event, user_id: userId ?? null, properties: jsonb(properties) })
      .execute();
    write.catch(() => {});
    await Promise.race([write, timeout]);
  } catch (error) {
    logger.warn("analytics_insert_failed", {
      event,
      status: error instanceof Error && error.message === "timeout" ? "timeout" : "database_error",
    });
  } finally {
    clearTimeout(timer);
  }
}
