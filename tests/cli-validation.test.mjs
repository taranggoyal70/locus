import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repoRoot, "bin", "locus.mjs");

/**
 * The CLI's caller is usually an agent, which cannot notice that output looks
 * wrong. Every case below previously exited 0 with a plausible-looking answer:
 *
 * - a mistyped --path reported "WIDENED to whole repo" over a Slice of zero
 *   files, which is the conservative fallback claiming it returned everything
 *   having returned nothing
 * - --budget abc became NaN and packed the entire Slice; --budget 0 did too
 * - a mistyped --jsonn was swallowed, so an agent expecting JSON got prose
 * - a trailing --path with no value silently analysed the working directory
 */
function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout, err: "" };
  } catch (error) {
    return {
      code: error.status ?? 1,
      out: error.stdout?.toString() ?? "",
      err: error.stderr?.toString() ?? "",
    };
  }
}

describe("locus locate argument validation", () => {
  it("refuses a path that does not exist instead of widening over nothing", () => {
    const result = run(["locate", "fix login", "--path", "/no/such/dir"]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/does not exist/);
    expect(result.out).not.toMatch(/WIDENED/);
  });

  it("refuses a path that is a file", () => {
    const result = run(["locate", "fix login", "--path", "package.json"]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/not a directory/);
  });

  it.each([
    ["abc", /whole number/],
    ["-5", /whole number/],
    ["1.5", /whole number/],
    ["0", /between/],
    ["999999999", /between/],
  ])("refuses --budget %s", (value, expected) => {
    const result = run(["locate", "admission", "--pack", "--budget", value]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(expected);
  });

  it("refuses an unknown option rather than silently ignoring it", () => {
    // The dangerous shape: an agent asks for --json, mistypes it, and receives
    // prose it will try to parse.
    const result = run(["locate", "admission", "--jsonn"]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/Unknown option: --jsonn/);
    expect(result.out).toBe("");
  });

  it.each([["--path"], ["--budget"], ["--evidence"]])("refuses a trailing %s", (flag) => {
    const result = run(["locate", "admission", flag]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/requires/);
  });

  it("still accepts every valid invocation", () => {
    expect(run(["locate", "admission tier"]).code).toBe(0);
    expect(run(["locate", "admission tier", "--json"]).code).toBe(0);
    expect(run(["locate", "admission tier", "--pack", "--budget", "20000"]).code).toBe(0);
  });

  it("emits parseable JSON for --json", () => {
    const result = run(["locate", "admission tier", "--json"]);
    expect(result.code).toBe(0);
    const parsed = JSON.parse(result.out);
    expect(Array.isArray(parsed.slice)).toBe(true);
    expect(typeof parsed.dir).toBe("string");
  });

  it("lets a task begin with a dash after the -- terminator", () => {
    // Rejecting unknown options would otherwise make such a task unaskable.
    const result = run(["locate", "--", "--json output is malformed"]);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/Repo:/);
  });
});

describe("locus locate repository preconditions", () => {
  it("refuses a directory with no supported source instead of widening over nothing", () => {
    // The hosted API already refuses this ("No JavaScript or TypeScript source
    // found"), so the CLI reporting "WIDENED to whole repo" over a Slice of zero
    // files meant the two surfaces disagreed on identical input — and the CLI was
    // the one that stayed quiet. Pointing at the wrong directory, at a project in
    // another language, or at one whose sources are all under an ignored path are
    // all ordinary ways to arrive here.
    const result = run(["locate", "fix login", "--path", "supabase/migrations"]);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/No JavaScript or TypeScript source found/);
    expect(result.out).not.toMatch(/WIDENED/);
  });
});
