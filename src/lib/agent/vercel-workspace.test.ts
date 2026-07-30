import { describe, expect, it } from "vitest";

import { normalizePublicGitHubRepository } from "@/lib/agent/vercel-workspace";

describe("Vercel workspace repository boundaries", () => {
  it("normalizes supported public GitHub repository inputs", () => {
    expect(normalizePublicGitHubRepository("taranggoyal70/locus")).toBe(
      "https://github.com/taranggoyal70/locus.git",
    );
    expect(normalizePublicGitHubRepository("https://github.com/vercel/ai.git")).toBe(
      "https://github.com/vercel/ai.git",
    );
  });

  it.each([
    "https://gitlab.com/acme/repo",
    "https://token@github.com/acme/repo",
    "git@github.com:acme/repo.git",
    "https://github.com/acme/repo/issues/1",
  ])("rejects unsafe or unsupported repository input: %s", (input) => {
    expect(() => normalizePublicGitHubRepository(input)).toThrow(
      "Repository must be a public GitHub owner/repository",
    );
  });
});
