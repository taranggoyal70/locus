// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FooterScene } from "@/components/FooterScene";
import { Mascot } from "@/components/Mascot";

describe("the mascot", () => {
  it("is decoration, drawn on whole pixels, in the mood it is given", () => {
    const html = renderToStaticMarkup(<Mascot mood="found" size={48} />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-mood="found"');
    expect(html).toContain('shape-rendering="crispEdges"');
    expect(html).toContain('width="48"');
    expect(html).toContain('height="57"');
  });
});

describe("the footer scene", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the same still field on the server every time, out of the accessibility tree", () => {
    const html = renderToStaticMarkup(<FooterScene />);

    expect(renderToStaticMarkup(<FooterScene />)).toBe(html);
    expect(html.startsWith('<div aria-hidden="true"')).toBe(true);
    expect(html).toContain('data-mood="idle"');
  });

  it("leaves the mascot standing and draws nothing with reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");

    const { container } = render(<FooterScene />);

    expect(getContext).not.toHaveBeenCalled();
    expect(container.querySelector(".mascot")?.getAttribute("data-mood")).toBe("idle");
  });
});
