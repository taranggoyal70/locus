// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useLocus } from "@/hooks/useLocus";
import type { RepoData } from "@/lib/types";

const DEMO_REPO: RepoData = {
  name: "Taxonomy",
  slug: "taxonomy",
  description: "Bundled demo Repo",
  root: "src",
  recentlyChanged: [],
  files: {
    "src/app/page.tsx": "export default function Page() { return null; }",
  },
};

const GITHUB_REPO: RepoData = {
  name: "owner/repo",
  slug: "owner-repo",
  description: "Loaded GitHub Repo",
  root: "src",
  recentlyChanged: [],
  files: {
    "src/app/dashboard/page.tsx": "export default function Dashboard() { return null; }",
  },
};

describe("Repo loading lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves the current Slice and retries the Repo that actually failed", async () => {
    const githubRequests: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/repos/")) return Response.json(DEMO_REPO);

      const { url } = JSON.parse(String(init?.body)) as { url: string };
      githubRequests.push(url);
      if (githubRequests.length === 1) {
        return Response.json(
          { error: "Repo requests are temporarily unavailable.", code: "temporary" },
          { status: 503 },
        );
      }
      return Response.json({ repo: GITHUB_REPO, fileCount: 1 });
    }));

    const { result } = renderHook(() => useLocus());
    await waitFor(() => expect(result.current.repo?.slug).toBe("taxonomy"));

    act(() => result.current.setGhUrl("owner/repo"));
    await act(async () => {
      await result.current.loadGithub();
    });

    expect(result.current.repo?.slug).toBe("taxonomy");
    expect(result.current.loadIssue).toMatchObject({
      code: "temporary",
      attemptedRepoSpecifier: "owner/repo",
    });

    act(() => result.current.setGhUrl("different/repo"));
    await act(async () => {
      await result.current.retryRepoLoad();
    });

    expect(githubRequests).toEqual(["owner/repo", "owner/repo"]);
    expect(result.current.repo?.slug).toBe("owner-repo");
    expect(result.current.loadIssue).toBeNull();
  });

  it("does not offer a Retry action when there is no failed Repo specifier", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const { result } = renderHook(() => useLocus());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.loadIssue).toMatchObject({
      retryable: false,
      attemptedRepoSpecifier: null,
    });
  });
});
