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

    fireEvent.click(screen.getByRole("button", { name: "Run the sequence" }));
    expect(demo?.getAttribute("data-stage")).toBe("1");
    expect((screen.getByRole("button", { name: "Migration running" }) as HTMLButtonElement).disabled).toBe(true);

    act(() => vi.advanceTimersByTime(4800));
    expect(demo?.getAttribute("data-stage")).toBe("4");

    act(() => vi.advanceTimersByTime(900));
    expect((screen.getByRole("button", { name: "Replay the sequence" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("lets a viewer inspect any stage without playing the timeline", () => {
    const { container } = render(<MigrationDemo />);

    fireEvent.click(screen.getByRole("button", { name: /3Patch/ }));

    expect(container.querySelector(".migration-demo")?.getAttribute("data-stage")).toBe("3");
    expect(screen.getByText("src/server/payments.ts").closest(".migration-diff")?.getAttribute("aria-hidden")).toBe("false");
  });
});
