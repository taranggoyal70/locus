import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = path.join(srcRoot, "components");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) return [];
    return [full];
  });
}

const componentNames = readdirSync(componentsDir)
  .filter((entry) => /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry))
  .map((entry) => entry.replace(/\.tsx$/, ""));

/**
 * Non-test source that could import a component. Tests are excluded on purpose:
 * a component only its own test imports is exactly the thing being looked for.
 */
const importers = sourceFiles(srcRoot).map((file) => ({
  file: path.relative(srcRoot, file),
  text: readFileSync(file, "utf8"),
}));

describe("no orphaned components", () => {
  // OnboardingBanner was written for first-time users, had a passing test, and
  // was rendered by nothing. ProjectsList was the retrieval half of the
  // workspace Save button and had been orphaned when /projects was repurposed,
  // leaving users saving analyses they could never see again.
  //
  // Neither failed anything. A component with a green test and no importer looks
  // exactly like working code from every angle except the running product, so
  // the only way to notice is to check.
  it.each(componentNames)("%s is rendered somewhere", (name) => {
    const usedBy = importers
      .filter(({ file, text }) =>
        file !== path.join("components", `${name}.tsx`)
        && text.includes(`@/components/${name}`))
      .map(({ file }) => file);

    expect(
      usedBy,
      `${name} is imported by nothing outside its own test. Render it or delete it.`,
    ).not.toEqual([]);
  });

  it("finds enough importers to make the assertion above meaningful", () => {
    // A directory move that emptied this scan would turn every case above into a
    // pass against nothing, which is the failure mode of every test that greps.
    expect(componentNames.length).toBeGreaterThan(10);
    expect(importers.length).toBeGreaterThan(40);
  });
});
