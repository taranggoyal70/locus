import { createHash } from "node:crypto";

export const CONTROLLED_ALPHA_DATA_POLICY_VERSION =
  "google-free-tier-public-data-2026-08-03" as const;

// R13: task text and similar free-form content is what a user typed about
// their own codebase. It belongs in the Run record the user can see and delete,
// and in the prompt the model must read to do the work. It does not belong in
// the analytics table, which exists to count events and is retained on a
// different schedule, read by different people, and never subject to the Run
// retention sweep.
//
// The rule applied here: analytics may record the shape of a request, never its
// content. A digest keeps grouping and deduplication possible ("this task was
// retried nine times") without keeping the words. Length keeps volume analysis
// possible without keeping the words.
//
// This is a conservative default chosen in the absence of a stated retention
// policy. Widening it is a product and privacy decision, not a code change.
export type ContentShape = {
  digest: string;
  characters: number;
};

/**
 * Reduce free-form user content to a shape safe to persist in analytics.
 *
 * The digest is truncated to 16 hex characters: enough to group and correlate,
 * short enough that it is not a useful handle for anything else.
 */
export function contentShape(value: string): ContentShape {
  return {
    digest: createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16),
    characters: value.length,
  };
}
