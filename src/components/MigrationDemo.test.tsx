// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MigrationDemo } from "@/components/MigrationDemo";

describe("MigrationDemo", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("plays the deterministic four-stage sequence and remains replayable", () => {
    vi.useFakeTimers();
    const { container } = render(<MigrationDemo />);
    const demo = container.querySelector(".migration-demo");

    fireEvent.click(screen.getByRole("button", { name: "Show me how it works" }));
    expect(demo?.getAttribute("data-stage")).toBe("1");
    expect((screen.getByRole("button", { name: "Update running" }) as HTMLButtonElement).disabled).toBe(true);

    act(() => vi.advanceTimersByTime(4800));
    expect(demo?.getAttribute("data-stage")).toBe("4");

    act(() => vi.advanceTimersByTime(900));
    expect((screen.getByRole("button", { name: "Replay the story" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("defaults to a plain-English explanation of the customer outcome", () => {
    render(<MigrationDemo />);

    expect(screen.getByRole("heading", { name: /Your software changed.*Your customers shouldn’t chase the fix/ })).toBeTruthy();
    expect(screen.getByText("Locus checks the app")).toBeTruthy();
    expect(screen.getByText("Approval packet")).toBeTruthy();
    expect(screen.queryByText("Repository aperture")).toBeNull();
    expect(screen.queryByText("pnpm typecheck")).toBeNull();
  });

  it("lets developers inspect the exact evidence vocabulary and code diff", () => {
    const { container } = render(<MigrationDemo />);

    fireEvent.click(screen.getByRole("button", { name: "Developer evidence" }));
    fireEvent.click(screen.getByRole("button", { name: /3Patch/ }));

    expect(container.querySelector(".migration-demo")?.getAttribute("data-audience")).toBe("developer");
    expect(container.querySelector(".migration-demo")?.getAttribute("data-stage")).toBe("3");
    expect(screen.getByText("Repository aperture")).toBeTruthy();
    expect(screen.getByText("pnpm typecheck")).toBeTruthy();
    expect(screen.getByText("src/server/payments.ts").closest(".migration-diff")?.getAttribute("aria-hidden")).toBe("false");
  });
});
