import { describe, expect, it } from "vitest";

import {
  AgentSlice,
  buildAgentPrompt,
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

    slice.widen("src/billing.ts");

    expect(slice.canRead("src/billing.ts")).toBe(true);
    expect(slice.ledger()).toEqual({
      included: ["src/dashboard.ts"],
      excluded: [],
      widened: ["src/billing.ts"],
      created: [],
    });
  });

  it("does not invent a Widen for a path outside the excluded ledger", () => {
    const slice = new AgentSlice({
      included: ["src/dashboard.ts"],
      excluded: ["src/billing.ts"],
    });

    expect(() => slice.widen("src/unknown.ts")).toThrow(
      "src/unknown.ts is not in the excluded file ledger",
    );
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

  it("caps noisy tool output while preserving the omitted count", () => {
    const output = truncateToolOutput("a".repeat(12_000), 1_000);

    expect(output).toHaveLength(1_031);
    expect(output).toContain("[truncated 11,000 characters]");
  });
});
