import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IncompleteRepositoryError,
  assertCompleteRepository,
  fetchAgentRepository,
  publicGitHubCoordinates,
  type FetchedAgentRepository,
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

// R11: a capped ingestion does not merely give the Agent less context, it
// gives it a wrong model of the repository. The excluded ledger is built from
// what was fetched, so a file that never arrived is invisible rather than
// excluded: the Agent cannot widen into it and will not know it exists.
// Sensitive-path classification and the trusted base used to rebuild the
// review diff come from the same partial view.
function fetchedRepository(
  overrides: Partial<FetchedAgentRepository> = {},
): FetchedAgentRepository {
  return {
    repo: {
      name: "owner/repo",
      slug: "owner-repo",
      description: "owner/repo",
      root: "src",
      recentlyChanged: [],
      files: { "src/a.ts": "export const a = 1;" },
    },
    cloneUrl: "https://github.com/owner/repo.git",
    resolvedRevision: "a".repeat(40),
    truncated: false,
    ...overrides,
  };
}

describe("repository ingestion admission", () => {
  it("admits a repository that was fetched completely", () => {
    expect(() => assertCompleteRepository(fetchedRepository())).not.toThrow();
  });

  it("refuses a truncated repository before any capability is granted", () => {
    expect(() => assertCompleteRepository(fetchedRepository({ truncated: true }))).toThrow(
      IncompleteRepositoryError,
    );
  });

  it("names the repository and what to do about it", () => {
    expect(() => assertCompleteRepository(fetchedRepository({ truncated: true }))).toThrow(
      /owner\/repo/,
    );
    expect(() => assertCompleteRepository(fetchedRepository({ truncated: true }))).toThrow(
      /Narrow the repository or raise the ingestion caps/,
    );
  });
});
