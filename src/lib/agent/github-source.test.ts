import { describe, expect, it } from "vitest";

import { publicGitHubCoordinates } from "@/lib/agent/github-source";

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
});
