import { describe, expect, it } from "vitest";

import { buildShareUrl, buildWorkspacePath, sharedWorkspaceViewFrom } from "@/lib/share";

const view = { repositorySpecifier: " owner/repo ", task: " fix auth " };

describe("buildShareUrl", () => {
  it("creates an authenticated workspace link", () => {
    expect(buildShareUrl("https://locus.example", view)).toBe(
      "https://locus.example/workspace?repo=owner%2Frepo&task=fix+auth",
    );
  });

  it("owns parsing and relative workspace serialization", () => {
    expect(sharedWorkspaceViewFrom({ repo: "owner/repo", task: "fix auth" })).toEqual({
      repositorySpecifier: "owner/repo",
      task: "fix auth",
    });
    expect(sharedWorkspaceViewFrom(new URLSearchParams("repo=owner%2Frepo&task=fix+auth"))).toEqual({
      repositorySpecifier: "owner/repo",
      task: "fix auth",
    });
    expect(buildWorkspacePath(view)).toBe("/workspace?repo=owner%2Frepo&task=fix+auth");
    expect(sharedWorkspaceViewFrom({ repo: ["owner/repo"], task: "fix auth" })).toBeNull();
  });
});
