// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProductDemo } from "@/components/ProductDemo";
import { RECORDED_SLICE } from "@/lib/landing-slice";
import { TRY_TASKS } from "@/lib/landing-tasks";

function stubBrowser(reduced: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    disconnect() {}
  });
}

const chapter = (name: RegExp) => screen.getByRole("button", { name });

describe("the home page demo", () => {
  beforeEach(() => stubBrowser(true));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the same markup every time on the server, with the recorded run described", () => {
    const html = renderToStaticMarkup(<ProductDemo />);

    expect(renderToStaticMarkup(<ProductDemo />)).toBe(html);
    expect(html).toContain(`aria-label="Locus on ${RECORDED_SLICE.repo}"`);
    expect(html).toContain("your task is not sent anywhere");
    expect(html).toContain(`localizes “${RECORDED_SLICE.task}”`);
    expect(html).toContain(`to ${RECORDED_SLICE.slice.length} of them`);
    for (const task of TRY_TASKS) expect(html).toContain(task);
    expect(html).toContain("Your own Repo");
    expect(html).not.toContain("—");
  });

  it("rests on the finished Slice, paused, with reduced motion", async () => {
    render(<ProductDemo />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Play the demo" })).toBeTruthy());
    expect(chapter(/03 Slice/).getAttribute("aria-current")).toBe("step");
    expect(screen.getByText(`${RECORDED_SLICE.slice.length} of ${RECORDED_SLICE.files.length} files, ${RECORDED_SLICE.savedPct}% fewer tokens`)).toBeTruthy();
  });

  it("jumps between chapters", async () => {
    render(<ProductDemo />);
    await waitFor(() => expect(chapter(/03 Slice/).getAttribute("aria-current")).toBe("step"));

    fireEvent.click(chapter(/01 Repo/));
    expect(chapter(/01 Repo/).getAttribute("aria-current")).toBe("step");
    expect(chapter(/03 Slice/).getAttribute("aria-current")).toBeNull();

    fireEvent.click(chapter(/04 Hand off/));
    expect(chapter(/04 Hand off/).getAttribute("aria-current")).toBe("step");
  });

  it("localizes a typed task in the tab and plays its Slice", async () => {
    render(<ProductDemo />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play the demo" })).toBeTruthy());

    const input = screen.getByLabelText(`A task for ${RECORDED_SLICE.repo}`);
    expect((screen.getByRole("button", { name: "Localize" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "  update the   marketing pricing page " } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Localize" }));
    });

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/^Playing "update the marketing pricing page": \d+ of \d+ files in the Slice\.$/));
    expect((input as HTMLInputElement).value).toBe("update the marketing pricing page");
  }, 20_000);

  it("plays a task that Widens as a Widen, and offers words to refine it with", async () => {
    render(<ProductDemo />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Play the demo" })).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "kubernetes helm chart rollback" }));
    });

    await waitFor(() => expect(screen.getByText("No match. Refine with")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toContain("no confident match, so Locus kept all");
    expect(screen.getByText(/^Widened: all/)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Back to the first task" }));
    });
    await waitFor(() => expect(screen.getByText("Try a task")).toBeTruthy());
    expect(screen.getByRole("status").textContent).toBe(
      `Playing "${RECORDED_SLICE.task}": ${RECORDED_SLICE.slice.length} of ${RECORDED_SLICE.files.length} files in the Slice.`,
    );
  });
});
