import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAgentRepository,
  publicGitHubCoordinates,
} from "@/lib/agent/github-source";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("agent GitHub source", () => {
  it("extracts a normalized public repository identity", () => {
    expect(publicGitHubCoordinates("taranggoyal70/locus")).toEqual({
      owner: "taranggoyal70",
      repo: "locus",
      cloneUrl: "https://github.com/taranggoyal70/locus.git",
    });
  });

  it("inherits the sandbox repository restrictions", () => {
    expect(() => publicGitHubCoordinates("git@github.com:acme/private.git")).toThrow(
      "Repository must be a public GitHub owner/repository",
    );
  });

  it("pins sandbox cloning and source downloads to the resolved commit", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/repos/acme/repo")) {
        return Response.json({ default_branch: "main", description: "Test repository" });
      }
      if (url.endsWith("/repos/acme/repo/commits/main")) {
        return Response.json({ sha: "commit-sha", commit: { tree: { sha: "tree-sha" } } });
      }
      if (url.includes("/git/trees/tree-sha")) {
        return Response.json({
          sha: "tree-sha",
          tree: [{ path: "src/index.ts", type: "blob", size: 20 }],
        });
      }
      if (url.includes("/commit-sha/src/index.ts")) {
        return new Response("export const ready = true;\n");
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetcher);

    const result = await fetchAgentRepository("acme/repo", "main");

    expect(result.resolvedRevision).toBe("commit-sha");
    expect(result.repo.files["src/index.ts"]).toContain("ready");
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/git/trees/tree-sha"))).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/commit-sha/src/index.ts"))).toBe(true);
  });
});
