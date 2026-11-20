// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CountUp, RiseWords } from "@/components/Reveal";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: ObserverCallback[] = [];

function stubMotion({ reduced = false } = {}) {
  observers = [];
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce") }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: ObserverCallback) { observers.push(callback); }
    observe() {}
    disconnect() {}
  });
  // Finish every frame at once: the clock is always past the end of the animation.
  vi.stubGlobal("requestAnimationFrame", (tick: FrameRequestCallback) => {
    tick(performance.now() + 5000);
    return 0;
  });
}

function onScreen() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ top: 10, bottom: 60 } as DOMRect);
}

describe("motion that only plays for what scrolls into view", () => {
  beforeEach(() => stubMotion());

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("counts up from zero once an offscreen number enters view", () => {
    const { container } = render(<CountUp value={53} suffix="%" />);

    expect(container.textContent).toBe("0%");
    act(() => observers[0]?.([{ isIntersecting: true }]));
    expect(container.textContent).toBe("53%");
  });

  it("leaves a number that starts on screen at its printed value", () => {
    onScreen();
    const { container } = render(<CountUp value={53} suffix="%" />);

    expect(container.textContent).toBe("53%");
    expect(observers).toHaveLength(0);
  });

  it("keeps everything final under reduced motion", () => {
    stubMotion({ reduced: true });
    const { container } = render(<RiseWords lines={["One task."]} />);

    expect(container.querySelector(".rise")?.classList.contains("is-armed")).toBe(false);
    expect(observers).toHaveLength(0);
  });

  it("holds an offscreen heading's words down until it enters view", () => {
    const { container } = render(<RiseWords as="h2" lines={["One task.", { text: "14 of 125 files.", className: "text-muted" }]} />);
    const heading = container.querySelector("h2");

    expect(heading?.textContent).toBe("One task.14 of 125 files.");
    expect(heading?.querySelectorAll(".rise-w")).toHaveLength(6);
    expect(heading?.classList.contains("is-armed")).toBe(true);
    act(() => observers[0]?.([{ isIntersecting: true }]));
    expect(heading?.classList.contains("is-armed")).toBe(false);
  });
});
