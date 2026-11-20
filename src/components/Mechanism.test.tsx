// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HOP_EDGES, MATCHED_TERMS, Mechanism } from "@/components/Mechanism";
import { RECORDED_SLICE } from "@/lib/landing-slice";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

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
});
