import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { CAPABILITY_RELEASE } from "@/lib/admission";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where Capabilities are defined and presented rather than enforced. */
const DEFINITION_FILES = new Set([
  path.join(srcRoot, "lib", "admission.ts"),
  path.join(srcRoot, "lib", "admission-server.ts"),
  path.join(srcRoot, "lib", "run-access.ts"),
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
    if (DEFINITION_FILES.has(full)) return [];
    return [full];
  });
}

const enforcementSources = sourceFiles(srcRoot).map((file) => ({
  file: path.relative(srcRoot, file),
  text: readFileSync(file, "utf8"),
}));

describe("every Capability is enforced somewhere", () => {
  // `savingsClaims` sat in the Capability record with no reader at all. Nothing
  // failed, which is the problem: an unread Capability describes access the
  // product does not actually control that way, and it invites someone to wire
  // it up later as a second and weaker gate on a question already answered
  // elsewhere.
  //
  // Definition and presentation files are excluded, because naming a Capability
  // in the table that declares it proves nothing about whether anything enforces
  // it.
  it.each(Object.keys(CAPABILITY_RELEASE))("%s has at least one enforcing call site", (capability) => {
    const consumers = enforcementSources
      .filter(({ text }) => text.includes(`"${capability}"`) || text.includes(`.${capability}`))
      .map(({ file }) => file);

    expect(
      consumers,
      `${capability} is declared but never read. Either enforce it or remove it.`,
    ).not.toEqual([]);
  });

  it("finds enough source to make the assertion above meaningful", () => {
    // Guards against a directory move silently emptying the scan and turning
    // every case above into a pass against nothing.
    expect(enforcementSources.length).toBeGreaterThan(40);
  });
});
