import { describe, expect, it, vi } from "vitest";

import { createGitHubPullRequest } from "@/lib/agent/github-delivery";

describe("GitHub agent delivery", () => {
  it("creates a commit, branch, and pull request from an approved change set", async () => {
    const responses = [
      { object: { sha: "base-commit" } },
      { tree: { sha: "base-tree" } },
      { sha: "blob-1" },
      { sha: "new-tree" },
      { sha: "new-commit" },
      { ref: "refs/heads/locus/fix-chart-12345678" },
      { html_url: "https://github.com/acme/repo/pull/12", number: 12 },
    ];
    const fetcher = vi.fn(async (...request: [string | URL | Request, RequestInit?]) => {
      expect(request[0]).toBeTruthy();
      return new Response(JSON.stringify(responses.shift()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await createGitHubPullRequest(
      {
        token: "secret",
        repository: "acme/repo",
        baseRef: "main",
        runId: "12345678-abcd-4000-8000-000000000000",
        task: "Fix chart rendering",
        summary: "Corrects the chart data adapter.",
        changes: [
          { path: "src/chart.ts", content: "export const chart = true;\n" },
          { path: "src/old.ts", content: null },
        ],
      },
      fetcher,
    );

    expect(result).toEqual({
      branch: "locus/fix-chart-12345678",
      pullRequestNumber: 12,
      url: "https://github.com/acme/repo/pull/12",
    });
    expect(fetcher).toHaveBeenCalledTimes(7);
    const calls = fetcher.mock.calls as Array<[string | URL | Request, RequestInit?]>;
    expect(calls[3]?.[1]?.body).toContain('"sha":null');
    expect(calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer secret",
    });
  });
});
