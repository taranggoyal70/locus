import type { Json } from "@/lib/database.types";

/**
 * Analytics properties that arrive from a browser are user input. R13's privacy
 * boundary is that analytics records the shape of what someone did, never the
 * words they typed - so every property a client may send is declared here by
 * name and kept only when it matches its declared form. Undeclared keys are
 * dropped rather than persisted, which is what makes free text structurally
 * unable to reach the events table instead of merely unlikely to.
 *
 * Server-side `track()` callers do not pass through this filter: they build
 * properties from values the server already holds, and hash anything derived
 * from user text before it gets there.
 */

type PropertyRule = { kind: "number" } | { kind: "enum"; values: readonly string[] };

const EVENT_PROPERTIES = {
  context_copied: {
    format: { kind: "enum", values: ["generic", "claude", "cursor"] },
    method: { kind: "enum", values: ["download"] },
    files: { kind: "number" },
    tokens: { kind: "number" },
  },
  context_feedback: {
    rating: { kind: "enum", values: ["up", "down"] },
    files: { kind: "number" },
    includedTokens: { kind: "number" },
    totalTokens: { kind: "number" },
  },
  // No in-tree producer sends these two. They stay accepted so any client
  // already emitting them keeps getting a 200, but nothing is recorded until
  // its properties are declared above - an undeclared key is dropped silently
  // by design, so declare before relying on a value being stored.
  task_analyzed: {},
  project_saved: {},
} as const satisfies Record<string, Record<string, PropertyRule>>;

export type ClientAnalyticsEvent = keyof typeof EVENT_PROPERTIES;

export const ALLOWED_EVENTS: readonly string[] = Object.keys(EVENT_PROPERTIES);

export function isAllowedEvent(event: string): event is ClientAnalyticsEvent {
  return Object.prototype.hasOwnProperty.call(EVENT_PROPERTIES, event);
}

/**
 * Keep only the declared properties for this event. Returns an empty object for
 * an unknown event or a non-object payload, so a caller can always persist the
 * result directly.
 */
export function filterEventProperties(event: string, raw: unknown): Record<string, Json> {
  const rules = EVENT_PROPERTIES[event as ClientAnalyticsEvent] as
    | Record<string, PropertyRule>
    | undefined;
  if (!rules || typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const filtered: Record<string, Json> = {};
  for (const [key, rule] of Object.entries(rules)) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = (raw as Record<string, unknown>)[key];

    if (rule.kind === "number") {
      if (typeof value === "number" && Number.isFinite(value)) filtered[key] = value;
      continue;
    }
    if (typeof value === "string" && rule.values.includes(value)) filtered[key] = value;
  }
  return filtered;
}
