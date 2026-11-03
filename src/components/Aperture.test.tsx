// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Aperture } from "@/components/Aperture";
import { RECORDED_SLICE } from "@/lib/landing-slice";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

function stubMotion(reduced: boolean) {
  const observers: ObserverCallback[] = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("reduce"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: ObserverCallback) { observers.push(callback); }
    observe() {}
    disconnect() {}
  });
  return observers;
}

function figure(container: HTMLElement) {
  return container.querySelector("figure.aperture") as HTMLElement;
}

describe("the Slice aperture", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("draws one mark per Repo file and states the recorded counts", () => {
    const html = renderToStaticMarkup(<Aperture />);

    expect(html.match(/class="aperture-mark"/g)).toHaveLength(RECORDED_SLICE.files.length);
    expect(html.match(/data-kind="excluded"/g)).toHaveLength(RECORDED_SLICE.files.length - RECORDED_SLICE.slice.length);
    expect(html.match(/data-kind="anchor"/g)).toHaveLength(RECORDED_SLICE.anchors.length);
    expect(html).toContain("Recorded run on");
    expect(html).toContain(RECORDED_SLICE.task);
    expect(html).toContain("6,448");
    expect(html).toContain("56,404");
  });

  it("stays open until it comes into view, then closes once", () => {
    const observers = stubMotion(false);
    const { container } = render(<Aperture />);

    expect(figure(container).classList.contains("is-open")).toBe(true);
    act(() => observers[0]?.([{ isIntersecting: false }]));
    expect(figure(container).classList.contains("is-open")).toBe(true);
    act(() => observers[0]?.([{ isIntersecting: true }]));
    expect(figure(container).classList.contains("is-open")).toBe(false);
  });

  it("shows the closed Slice at once under reduced motion", () => {
    const observers = stubMotion(true);
    const { container } = render(<Aperture />);

    expect(figure(container).classList.contains("is-open")).toBe(false);
    expect(observers).toHaveLength(0);
  });
});
