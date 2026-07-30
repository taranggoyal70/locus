import { describe, expect, it } from "vitest";

import { createGitHubOAuthState, verifyGitHubOAuthState } from "@/lib/github-oauth-state";

describe("GitHub OAuth state", () => {
  it("round-trips a signed, short-lived state", () => {
    const state = createGitHubOAuthState("user_123", "secret", 1_000);
    expect(verifyGitHubOAuthState(state, "user_123", "secret", 5_000)).toBe(true);
  });

  it("rejects tampering, another user, and expired state", () => {
    const state = createGitHubOAuthState("user_123", "secret", 1_000);
    expect(verifyGitHubOAuthState(`${state}x`, "user_123", "secret", 5_000)).toBe(false);
    expect(verifyGitHubOAuthState(state, "user_456", "secret", 5_000)).toBe(false);
    expect(verifyGitHubOAuthState(state, "user_123", "secret", 700_001)).toBe(false);
  });
});
