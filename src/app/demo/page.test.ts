import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));
const emptySearchParams = Promise.resolve({});

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import DemoPage from "@/app/(clerk)/demo/page";

describe("legacy demo route", () => {
  beforeEach(() => {
    mocks.redirect.mockReset();
  });

  it("sends visitors through the public early-access workspace", async () => {
    await DemoPage({ searchParams: emptySearchParams });
    expect(mocks.redirect).toHaveBeenCalledWith("/workspace");
  });

  it("preserves legacy deep links through authentication", async () => {
    await DemoPage({
      searchParams: Promise.resolve({ repo: "owner/repo", task: "fix auth" }),
    });
    expect(mocks.redirect).toHaveBeenCalledWith(
      "/workspace?repo=owner%2Frepo&task=fix+auth",
    );
  });
});
