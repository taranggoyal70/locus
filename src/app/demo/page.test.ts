import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), redirect: vi.fn() }));
const emptySearchParams = Promise.resolve({});

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import DemoPage from "@/app/demo/page";

describe("legacy demo route", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.redirect.mockReset();
  });

  it("sends signed-out visitors to login", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await DemoPage({ searchParams: emptySearchParams });
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-in");
  });

  it("sends signed-in visitors to their workspace", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_123" });
    await DemoPage({ searchParams: emptySearchParams });
    expect(mocks.redirect).toHaveBeenCalledWith("/workspace");
  });

  it("preserves authenticated legacy deep links", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_123" });
    await DemoPage({
      searchParams: Promise.resolve({ repo: "owner/repo", task: "fix auth" }),
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/workspace?repo=owner%2Frepo&task=fix+auth",
    );
  });
});
