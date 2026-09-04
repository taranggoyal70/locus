import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { runQuotaForTier } from "@/lib/admission";
import {
  admissionHeadline,
  admissionSentence,
  admissionTag,
  runStartRefusal,
  signInDescription,
  signUpDescription,
  supportAvailability,
  demoCapabilitySummary,
} from "@/lib/admission-copy";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Claims about who may start an Agent Run, stated as literals.
 *
 * Seven public surfaces each wrote their own version of these, and every one
 * would have become false the moment LOCUS_SELF_SERVE was set - on the pages a
 * stranger reads first. check:alpha-claims cannot catch it: the sentences are
 * accurate in the source and wrong only relative to a deployment setting.
 */
const DOOR_CLAIMS = ["invite-gated", "invited design partners", "invited Agent Run"];

/** The one module allowed to contain them. */
const OWNER = path.join(srcRoot, "lib", "admission-copy.ts");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
    return [full];
  });
}

/** Strip comments, so a commented explanation of the old wording is not a claim. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("admission copy", () => {
  it("says the opposite thing on each side of the door", () => {
    const open = [
      admissionTag(true),
      admissionSentence(true),
      admissionHeadline(true),
      signUpDescription(true),
      signInDescription(true),
      supportAvailability(true),
      demoCapabilitySummary(true),
    ];
    for (const line of open) {
      expect(line, line).not.toMatch(/invite-gated|invited design partners|invited Agent Run/);
    }

    const closed = [
      admissionTag(false),
      admissionSentence(false),
      admissionHeadline(false),
      signUpDescription(false),
      signInDescription(false),
      supportAvailability(false),
      demoCapabilitySummary(false),
    ];
    for (const line of closed) {
      expect(line, line).toMatch(/invite-gated|invited design partners|invited Agent Run/);
    }
  });

  it("never advertises the per-account allowance as capacity a caller will get", () => {
    // A Tier grants up to `maxDailyRuns` Runs a day, but free execution capacity
    // is one shared Run per UTC day across the whole deployment. Printing the
    // per-account number on a public surface would promise capacity that does
    // not exist: the Tier is a ceiling on what one account may hold, not an
    // allocation. This caught exactly that when the free-beta branch merged.
    const daily = String(runQuotaForTier("free").maxDailyRuns);
    for (const line of [
      admissionTag(true),
      admissionSentence(true),
      signUpDescription(true),
      supportAvailability(true),
      demoCapabilitySummary(true),
    ]) {
      expect(line, line).not.toContain(`${daily} per day`);
    }
  });

  it("points an open deployment at the shared daily Run", () => {
    for (const line of [admissionTag(true), admissionSentence(true), signUpDescription(true)]) {
      expect(line.toLowerCase(), line).toMatch(/shared|daily/);
    }
  });

  it("never tells an account to wait for an invitation that does not exist", () => {
    // unverified_email and at_capacity happen only while self-serve is open,
    // which is exactly when there is no invitation to wait for.
    for (const reason of ["unverified_email", "at_capacity", "suspended"] as const) {
      expect(runStartRefusal(reason), reason).not.toMatch(/invited|invitation/);
    }
  });

  it("is the only place these claims are written", () => {
    // Seven copies is how six get fixed and one is missed. Verified by moving
    // the last inline pair here: the claims now appear in exactly one file.
    const offenders = sourceFiles(srcRoot)
      .filter((file) => file !== OWNER)
      .filter((file) => {
        const text = code(readFileSync(file, "utf8"));
        return DOOR_CLAIMS.some((claim) => text.includes(claim));
      })
      .map((file) => path.relative(srcRoot, file));

    expect(
      offenders,
      "These files hard-code an admission claim. Use @/lib/admission-copy so it follows the door.",
    ).toEqual([]);
  });
});
