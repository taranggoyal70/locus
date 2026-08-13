import { describe, expect, it } from "vitest";

import {
  AgentSlice,
  MAX_WIDENED_FILES,
  buildAgentPrompt,
  classifySensitivePath,
  truncateToolOutput,
  validateAgentCommand,
  validateRepoPath,
} from "@/lib/agent/workspace-tools";

describe("agent Slice permissions", () => {
  it("requires an explicit Widen before excluded source can be read", () => {
    const slice = new AgentSlice({
      included: ["src/dashboard.ts"],
      excluded: ["src/billing.ts"],
    });

    expect(slice.canRead("src/dashboard.ts")).toBe(true);
    expect(slice.canRead("src/billing.ts")).toBe(false);

    slice.widen("src/billing.ts", "the total is computed here");

    expect(slice.canRead("src/billing.ts")).toBe(true);
    expect(slice.ledger()).toEqual({
      included: ["src/dashboard.ts"],
      excluded: [],
      widened: ["src/billing.ts"],
      widenReasons: [{ path: "src/billing.ts", reason: "the total is computed here" }],
      created: [],
    });
  });

  it("does not invent a Widen for a path outside the excluded ledger", () => {
    const slice = new AgentSlice({
      included: ["src/dashboard.ts"],
      excluded: ["src/billing.ts"],
    });

    expect(() => slice.widen("src/unknown.ts", "needed")).toThrow(
      "src/unknown.ts is not in the excluded file ledger",
    );
  });

  // R6: widening is a capability grant, so the justification is enforced
  // rather than collected and discarded.
  it("refuses to widen without a concrete reason", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: ["src/b.ts"] });

    expect(() => slice.widen("src/b.ts", "   ")).toThrow("Widening requires a concrete reason");
    expect(slice.canRead("src/b.ts")).toBe(false);
  });

  it("bounds how far a Run may widen beyond its Slice", () => {
    const excluded = Array.from({ length: MAX_WIDENED_FILES + 1 }, (_, n) => `src/f${n}.ts`);
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded });

    for (let n = 0; n < MAX_WIDENED_FILES; n += 1) {
      slice.widen(`src/f${n}.ts`, "needed");
    }

    expect(() => slice.widen(`src/f${MAX_WIDENED_FILES}.ts`, "needed")).toThrow(
      `Run exceeded the ${MAX_WIDENED_FILES} widened file limit`,
    );
  });
});

describe("sensitive path policy", () => {
  it.each([
    [".github/workflows/ci.yml", "CI and workflow configuration"],
    ["package.json", "package manifest or lockfile"],
    ["pnpm-lock.yaml", "package manifest or lockfile"],
    [".npmrc", "package manifest or lockfile"],
    ["supabase/migrations/016_x.sql", "database migration"],
    ["vercel.json", "deployment configuration"],
    ["next.config.ts", "deployment configuration"],
    ["Dockerfile", "deployment configuration"],
    ["src/middleware.ts", "authentication or security code"],
    ["src/lib/auth/session.ts", "authentication or security code"],
    ["src/lib/agent/workspace-tools.ts", "Agent policy code"],
  ])("classifies %s", (path, label) => {
    expect(classifySensitivePath(path)).toBe(label);
  });

  it.each([
    "src/app/page.tsx",
    "src/lib/localizer.ts",
    "README.md",
    "docs/authors.md",
  ])("leaves ordinary product code unclassified: %s", (path) => {
    expect(classifySensitivePath(path)).toBeNull();
  });

  it("refuses to widen a sensitive path even with a good reason", () => {
    const slice = new AgentSlice({
      included: ["src/a.ts"],
      excluded: [".github/workflows/ci.yml"],
    });

    expect(() => slice.widen(".github/workflows/ci.yml", "the build is failing")).toThrow(
      /requires elevated review/,
    );
  });

  it("refuses to create a sensitive path", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: [] });

    expect(() => slice.create(".github/workflows/release.yml")).toThrow(
      /requires elevated review/,
    );
  });

  // Being inside the Slice is not authority to rewrite the rules: the
  // localizer can legitimately include a manifest as context.
  it("refuses to write a sensitive path already inside the Slice", () => {
    const slice = new AgentSlice({ included: ["package.json"], excluded: [] });

    expect(slice.canRead("package.json")).toBe(true);
    expect(slice.canWrite("package.json")).toBe(false);
  });

  it("tracks new files separately from localized source", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: [] });

    slice.create("src/a.test.ts");

    expect(slice.canWrite("src/a.test.ts")).toBe(true);
    expect(slice.ledger().created).toEqual(["src/a.test.ts"]);
  });
});

describe("agent command boundary", () => {
  it.each([
    "pnpm test",
    "pnpm exec vitest run src/lib/localizer.test.ts",
    "pnpm lint",
    "pnpm build",
    "npm test -- --runInBand",
    "npm run typecheck",
    "yarn test",
    "bun test",
  ])("allows a verification command: %s", (command) => {
    expect(validateAgentCommand(command)).toBe(command);
  });

  it.each([
    "git push origin main",
    "git commit -am ship",
    "vercel --prod",
    "curl https://example.com",
    "pnpm test && env",
    "npm run lint; rm -rf .",
    "pnpm exec sh",
    "cat /etc/passwd",
  ])("blocks an external, destructive, or secret-reading command: %s", (command) => {
    expect(() => validateAgentCommand(command)).toThrow("Command is outside the verification allowlist");
  });

  it("rejects paths outside the repository", () => {
    expect(validateRepoPath("src/app/page.tsx")).toBe("src/app/page.tsx");
    expect(() => validateRepoPath("../.env")).toThrow("Path must stay inside the repository");
    expect(() => validateRepoPath("/etc/passwd")).toThrow("Path must stay inside the repository");
    expect(() => validateRepoPath(".git/config")).toThrow("Path must stay inside the repository");
  });

  it.each([
    // A nested repository or submodule puts a writable .git well below the
    // root; writing there rewrites the history the review diff is computed
    // against. The original check only looked at the first segment.
    "vendor/.git/config",
    "a/b/.git/hooks/pre-commit",
    // Case-insensitive filesystems resolve these to the same directory.
    ".GIT/config",
    "vendor/.Git/config",
    // Normalization hazards: two spellings of one file let a ledger check on
    // one form be bypassed with the other.
    "src//app/page.tsx",
    "src/./app/page.tsx",
    "src/app/",
    // Escapes that never use a leading slash.
    "C:/Windows/System32/drivers/etc/hosts",
    "src/app\u0000/page.tsx",
    "src/\u001bapp/page.tsx",
  ])("rejects a path that evades the first-segment check: %j", (input) => {
    expect(() => validateRepoPath(input)).toThrow("Path must stay inside the repository");
  });

  it.each([
    // Dotfiles that merely start with ".git" are ordinary tracked files.
    ".gitignore",
    ".gitattributes",
    ".github/workflows/ci.yml",
  ])("still admits an ordinary dotfile: %s", (input) => {
    expect(validateRepoPath(input)).toBe(input);
  });
});

describe("agent context budget", () => {
  it("starts with included contents and an excluded path ledger", () => {
    const prompt = buildAgentPrompt({
      task: "Fix the dashboard total",
      acceptanceCriteria: ["The total matches the API response"],
      reason: "dashboard path and source matched",
      baselineTokens: 12_000,
      included: [
        {
          path: "src/dashboard.ts",
          content: "export const total = 0;",
        },
      ],
      excluded: ["src/billing.ts"],
    });

    expect(prompt).toContain("src/dashboard.ts");
    expect(prompt).toContain("export const total = 0;");
    expect(prompt).toContain("src/billing.ts");
    expect(prompt).toContain("12,000");
    expect(prompt).toContain("widen_file");
  });

  it("warns before included files when the Slice came from a sparse graph", () => {
    const prompt = buildAgentPrompt({
      task: "Fix the dashboard total",
      acceptanceCriteria: [],
      reason: "dashboard path and source matched",
      baselineTokens: 12_000,
      sparse: true,
      edgeDensity: 0,
      included: [
        {
          path: "src/dashboard.ts",
          content: "export const total = 0;",
        },
      ],
      excluded: ["src/billing.ts"],
    });

    expect(prompt).toContain("Warning: few internal imports resolved (0.00 edges/file)");
    expect(prompt.indexOf("Warning: few internal imports resolved")).toBeLessThan(
      prompt.indexOf("===== src/dashboard.ts ====="),
    );
  });

  it("caps noisy tool output while preserving the omitted count", () => {
    const output = truncateToolOutput("a".repeat(12_000), 1_000);

    expect(output).toHaveLength(1_031);
    expect(output).toContain("[truncated 11,000 characters]");
  });
});
