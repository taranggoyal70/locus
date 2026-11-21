// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HOP_EDGES, MATCHED_TERMS, Mechanism } from "@/components/Mechanism";
import { RECORDED_SLICE } from "@/lib/landing-slice";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const BEATS = ["b1", "b2", "b3", "b4", "b5"];
const beats = (element: Element) => BEATS.filter((beat) => element.classList.contains(beat));

function stubBrowser({ reduced = false } = {}) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce"), media: query }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
}

describe("Fig. 2, the mechanism", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("draws only imports that step the Closure out by one hop", () => {
    const dist = new Map<string, number>(RECORDED_SLICE.slice.map(({ path, dist }) => [path, dist]));

    expect(HOP_EDGES.length).toBeGreaterThan(0);
    for (const [from, to] of HOP_EDGES) expect(dist.get(to)).toBe((dist.get(from) ?? 0) + 1);
  });

  it("highlights task words that appear in an Anchor path, and nothing else", () => {
    expect(MATCHED_TERMS).toEqual(["post", "editor"]);
  });

  it("renders the finished figure on the server: every Slice file and the final token count", () => {
    const html = renderToStaticMarkup(<Mechanism />);

    for (const { path } of RECORDED_SLICE.slice) expect(html).toContain(path);
    expect(html).toMatch(/class="mech b1 b2 b3 b4 b5/);
    expect(html).toContain("6,448");
    expect(html).toContain("111 files held outside");
    // Nothing to replay before scripts run.
    expect(html).not.toContain("Replay");
  });

  it("starts from the whole Repo when it begins offscreen, then plays every beat once in view", () => {
    vi.useFakeTimers();
    const observers: ObserverCallback[] = [];
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: ObserverCallback) { observers.push(callback); }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (tick: FrameRequestCallback) => {
      tick(performance.now() + 5000);
      return 0;
    });

    const { container } = render(<Mechanism />);
    const figure = container.querySelector(".mech") as HTMLElement;

    expect(figure.classList.contains("b1")).toBe(false);
    expect(container.querySelector(".mech-count")?.textContent).toBe("56,404");
    act(() => observers[0]?.([{ isIntersecting: true }]));
    act(() => { vi.advanceTimersByTime(5000); });
    expect(["b1", "b2", "b3", "b4", "b5"].every((beat) => figure.classList.contains(beat))).toBe(true);
    expect(container.querySelector(".mech-count")?.textContent).toBe("6,448");
  });

  it("replays from the start: every beat clears at once, then returns in order", () => {
    vi.useFakeTimers();
    stubBrowser();
    const { container } = render(<Mechanism />);
    const figure = container.querySelector(".mech") as HTMLElement;
    expect(beats(figure)).toEqual(BEATS);

    fireEvent.click(screen.getByRole("button", { name: "Replay Fig. 2" }));
    expect(beats(figure)).toEqual([]);

    act(() => { vi.advanceTimersByTime(0); });
    expect(beats(figure)).toEqual(["b1"]);
    act(() => { vi.advanceTimersByTime(1300); });
    expect(beats(figure)).toEqual(["b1", "b2"]);

    // Replaying mid-play cancels the beats still pending from the first play.
    fireEvent.click(screen.getByRole("button", { name: "Replay Fig. 2" }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(beats(figure)).toEqual(["b1"]);
    act(() => { vi.advanceTimersByTime(2700); });
    expect(beats(figure)).toEqual(BEATS);
  });

  it("offers no Replay with reduced motion, where the figure never animates", () => {
    stubBrowser({ reduced: true });
    render(<Mechanism />);
    expect(screen.queryByRole("button", { name: "Replay Fig. 2" })).toBeNull();
  });
});
