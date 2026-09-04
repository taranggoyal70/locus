import { runQuotaForTier, type AdmissionReason } from "@/lib/admission";

/**
 * The one sentence every public surface uses to describe who can start an Agent
 * Run.
 *
 * Six surfaces had written their own version of it - the landing hero, the
 * marketing footer, the pricing heading, its metadata description, the demo, and
 * the sign-up form. All six said "invite-gated" or "invited design partners",
 * and all six would have become false the moment self-serve opened, on the pages
 * a stranger reads first.
 *
 * Centralised so the next change is one edit rather than six, and so a surface
 * added later has something correct to reach for instead of copying whichever
 * neighbour it was pasted from.
 *
 * The functions take the flag rather than reading it, because half these
 * surfaces are client components that cannot see a non-public environment
 * variable. Their server parent reads it and passes it down, which keeps one
 * source of truth instead of adding a NEXT_PUBLIC_ mirror that could disagree
 * with the real one.
 */

/** A short tag for a hero or a status strip. */
export function admissionTag(selfServeOpen: boolean): string {
  return selfServeOpen
    ? `Public early access · public Repos only · ${runQuotaForTier("free").maxDailyRuns} free Agent Runs a day`
    : "Public early access · public Repos only · Agent Runs invite-gated";
}

/** A full sentence for a footer or a paragraph. */
export function admissionSentence(selfServeOpen: boolean): string {
  return selfServeOpen
    ? "Public-Repo localization with visible context evidence. Agent Runs are included with a free "
      + `account, ${runQuotaForTier("free").maxDailyRuns} per day.`
    : "Public-Repo localization with visible context evidence. Agent Runs remain invite-gated "
      + "during early access.";
}

/** A heading that states the current boundary. */
export function admissionHeadline(selfServeOpen: boolean): string {
  return selfServeOpen
    ? "Repo localization and Agent Runs are open."
    : "Repo localization is open. Agent Runs are invite-gated.";
}

/**
 * Why the API refused to start a Run.
 *
 * The route previously answered every non-suspended refusal with "limited to
 * invited design partners", which is wrong for an account held back by an
 * unverified email or by the deployment ceiling - both of which happen only
 * while self-serve is open, i.e. exactly when no invitation exists to wait for.
 */
export function runStartRefusal(reason: AdmissionReason): string {
  switch (reason) {
    case "suspended":
      return "This account cannot start Agent Runs. Contact support.";
    case "unverified_email":
      return "Verify your email address to start Agent Runs.";
    case "at_capacity":
      return "Free Agent Runs are at capacity. Request access to be admitted.";
    default:
      return "Agent Runs are limited to invited design partners during early access.";
  }
}

/** The sign-up page's description. */
export function signUpDescription(selfServeOpen: boolean): string {
  return selfServeOpen
    ? "Create a free account and localize a real TypeScript or Next.js task. Agent Runs are "
      + `included, ${runQuotaForTier("free").maxDailyRuns} per day.`
    : "Create a free account and localize a real TypeScript or Next.js task. Agent Runs are "
      + "available to invited design partners.";
}

/** The sign-in page's description. */
export function signInDescription(selfServeOpen: boolean): string {
  return selfServeOpen
    ? "Sign in to localize a public Repo, inspect visible context evidence, or resume an Agent Run."
    : "Sign in to localize a public Repo, inspect visible context evidence, or resume an invited "
      + "Agent Run.";
}

/** The support page's availability line. */
export function supportAvailability(selfServeOpen: boolean): string {
  return selfServeOpen
    ? "Locus is in public early access. Agent Runs are included with a free account, "
      + `${runQuotaForTier("free").maxDailyRuns} per day.`
    : "Locus is in public early access, with Agent Runs limited to invited design partners.";
}

/** The demo page's capability summary, for a developer audience. */
export function demoCapabilitySummary(selfServeOpen: boolean): string {
  return "Public JavaScript and TypeScript Repo localization, visible Included and Excluded files, "
    + "evidence-backed Widening, and "
    + (selfServeOpen
      ? "isolated Agent Runs on a free account."
      : "invite-gated isolated Agent Runs.");
}
