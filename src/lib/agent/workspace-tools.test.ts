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
      widenAttempts: [{
        sequence: 1,
        path: "src/billing.ts",
        reason: "the total is computed here",
        outcome: "granted",
        refusal: null,
        detail: null,
      }],
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
  it("keeps Slice contents behind read_file instead of repeating them on every model turn", () => {
    const included = Array.from(
      { length: 500 },
      (_, index) => `src/features/feature-${index.toString().padStart(3, "0")}.ts`,
    );
    const prompt = buildAgentPrompt({
      task: "Fix the dashboard total",
      acceptanceCriteria: ["The total matches the API response"],
      reason: "dashboard path and source matched",
      baselineTokens: 180_000,
      included,
      excluded: ["src/billing.ts"],
    });

    expect(prompt).toContain(included[0]);
    expect(prompt).toContain(included[499]);
    expect(prompt).toContain("read_file");
    expect(prompt.length).toBeLessThan(25_000);
  });

  it("starts with included and excluded path ledgers", () => {
    const prompt = buildAgentPrompt({
      task: "Fix the dashboard total",
      acceptanceCriteria: ["The total matches the API response"],
      reason: "dashboard path and source matched",
      baselineTokens: 12_000,
      included: ["src/dashboard.ts"],
      excluded: ["src/billing.ts"],
    });

    expect(prompt).toContain("src/dashboard.ts");
    expect(prompt).toContain("src/billing.ts");
    expect(prompt).toContain("12,000");
    expect(prompt).toContain("read_file");
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
      included: ["src/dashboard.ts"],
      excluded: ["src/billing.ts"],
    });

    expect(prompt).toContain("Warning: few internal imports resolved (0.00 edges/file)");
    expect(prompt.indexOf("Warning: few internal imports resolved")).toBeLessThan(
      prompt.indexOf("- src/dashboard.ts"),
    );
  });

  it("caps noisy tool output while preserving the omitted count", () => {
    const output = truncateToolOutput("a".repeat(12_000), 1_000);

    expect(output).toHaveLength(1_031);
    expect(output).toContain("[truncated 11,000 characters]");
  });
});

// R14: the in-sandbox write allowlist is built from this, so it has to be
// narrower than the read set wherever canWrite is.
describe("AgentSlice.writablePaths", () => {
  it("omits a sensitive file that is readable but never writable", () => {
    const slice = new AgentSlice({
      included: ["src/app.ts", ".github/workflows/ci.yml"],
      excluded: [],
    });

    expect(slice.readablePaths()).toContain(".github/workflows/ci.yml");
    expect(slice.writablePaths()).not.toContain(".github/workflows/ci.yml");
    expect(slice.writablePaths()).toContain("src/app.ts");
  });

  it("agrees with canWrite for every readable path", () => {
    const slice = new AgentSlice({
      included: ["src/a.ts", "src/b.ts", ".github/workflows/ci.yml"],
      excluded: [],
    });

    const writable = new Set(slice.writablePaths());
    for (const path of slice.readablePaths()) {
      expect(writable.has(path), path).toBe(slice.canWrite(path));
    }
  });

  it("includes a file the Agent created during the run", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: [] });
    slice.create("src/new.ts");
    expect(slice.writablePaths()).toContain("src/new.ts");
  });
});

// R15: a Run that repeatedly probes for a way out of its Slice must look
// different, in the evidence a human reads, from one that never tried.
describe("AgentSlice widen attempt ledger", () => {
  it("records a granted widen with its justification", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: ["src/b.ts"] });
    slice.widen("src/b.ts", "the caller lives here");

    expect(slice.ledger().widenAttempts).toEqual([{
      sequence: 1,
      path: "src/b.ts",
      reason: "the caller lives here",
      outcome: "granted",
      refusal: null,
      detail: null,
    }]);
  });

  it("records a refusal into a sensitive path, which previously vanished", () => {
    const slice = new AgentSlice({
      included: ["src/a.ts"],
      excluded: [".github/workflows/ci.yml"],
    });

    expect(() => slice.widen(".github/workflows/ci.yml", "need to fix CI"))
      .toThrow(/elevated review/);

    const attempts = slice.ledger().widenAttempts;
    expect(attempts).toHaveLength(1);
    expect(attempts[0].outcome).toBe("refused");
    expect(attempts[0].refusal).toBe("sensitive_path");
    expect(attempts[0].reason).toBe("need to fix CI");
    // The stored detail is the message the Agent was given, so the reviewer
    // reads exactly what the Agent read.
    expect(attempts[0].detail).toMatch(/elevated review/);
  });

  it("preserves the order of a repeated probe", () => {
    const slice = new AgentSlice({
      included: ["src/a.ts"],
      excluded: [".github/workflows/ci.yml", "package.json", "src/b.ts"],
    });

    expect(() => slice.widen(".github/workflows/ci.yml", "one")).toThrow();
    expect(() => slice.widen("package.json", "two")).toThrow();
    slice.widen("src/b.ts", "three");

    const attempts = slice.ledger().widenAttempts;
    expect(attempts.map((a) => a.sequence)).toEqual([1, 2, 3]);
    expect(attempts.map((a) => a.outcome)).toEqual(["refused", "refused", "granted"]);
    expect(attempts.map((a) => a.reason)).toEqual(["one", "two", "three"]);
  });

  it("records a missing justification as its own cause", () => {
    const slice = new AgentSlice({ included: [], excluded: ["src/b.ts"] });
    expect(() => slice.widen("src/b.ts", "   ")).toThrow(/concrete reason/);
    expect(slice.ledger().widenAttempts[0].refusal).toBe("missing_reason");
  });

  it("records an attempt on a path that is not excluded at all", () => {
    const slice = new AgentSlice({ included: ["src/a.ts"], excluded: [] });
    expect(() => slice.widen("src/elsewhere.ts", "curious")).toThrow(/excluded file ledger/);
    expect(slice.ledger().widenAttempts[0].refusal).toBe("not_excluded");
  });

  it("records a traversal attempt, keeping the raw input as the evidence", () => {
    const slice = new AgentSlice({ included: [], excluded: [] });
    expect(() => slice.widen("../../etc/passwd", "need it")).toThrow(/inside the repository/);

    const attempt = slice.ledger().widenAttempts[0];
    expect(attempt.refusal).toBe("invalid_path");
    expect(attempt.path).toBe("../../etc/passwd");
  });

  it("records the attempt that exceeds the widen ceiling", () => {
    const excluded = Array.from({ length: MAX_WIDENED_FILES + 1 }, (_, i) => `src/f${i}.ts`);
    const slice = new AgentSlice({ included: [], excluded });

    for (let i = 0; i < MAX_WIDENED_FILES; i++) slice.widen(`src/f${i}.ts`, "needed");
    expect(() => slice.widen(`src/f${MAX_WIDENED_FILES}.ts`, "one more")).toThrow(/limit/);

    const attempts = slice.ledger().widenAttempts;
    expect(attempts).toHaveLength(MAX_WIDENED_FILES + 1);
    expect(attempts.at(-1)?.refusal).toBe("limit_exceeded");
  });

  it("leaves the grant-only list unchanged, so the proposal hash keeps its meaning", () => {
    const slice = new AgentSlice({ included: [], excluded: ["src/b.ts", "package.json"] });
    slice.widen("src/b.ts", "needed");
    expect(() => slice.widen("package.json", "also needed")).toThrow();

    expect(slice.ledger().widenReasons).toEqual([{ path: "src/b.ts", reason: "needed" }]);
    expect(slice.ledger().widenAttempts).toHaveLength(2);
  });
});
