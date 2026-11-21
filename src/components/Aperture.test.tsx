// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Aperture } from "@/components/Aperture";
import { RECORDED_SLICE } from "@/lib/landing-slice";

// The landing page replays recorded runs and must never load the localizer
// (docs/security/ip-protection.md): importing it from anything Fig. 1 uses
// fails this file.
vi.mock("@/lib/localizer", () => {
  throw new Error("Fig. 1 loaded the localizer");
});

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observers: ObserverCallback[] = [];

function stubBrowser(reduced: boolean) {
  observers = [];
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduced && query.includes("reduce") }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: ObserverCallback) { observers.push(callback); }
    observe() {}
    disconnect() {}
  });
}

const figure = (container: HTMLElement) => container.querySelector("figure.aperture") as HTMLElement;
const input = () => screen.getByLabelText(/Task|Your turn/) as HTMLInputElement;

describe("the Slice aperture", () => {
  beforeEach(() => stubBrowser(false));

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the recorded run on the server, one mark per Repo file", () => {
    const html = renderToStaticMarkup(<Aperture />);

    expect(html.match(/class="aperture-mark"/g)).toHaveLength(RECORDED_SLICE.files.length);
    expect(html.match(/data-kind="anchor"/g)).toHaveLength(RECORDED_SLICE.anchors.length);
    expect(html).toContain("Recorded run on");
    expect(html).toContain(RECORDED_SLICE.task);
    expect(html).toContain("6,448");
  });

  it("replays a recorded task, and hands over for good", async () => {
    const { container } = render(<Aperture />);

    fireEvent.pointerDown(input());
    fireEvent.change(input(), { target: { value: "update the marketing pricing page" } });
    fireEvent.click(screen.getByRole("button", { name: "Localize" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("6 of 125 files in the Slice."));
    expect(container.textContent).toContain("Recorded run on");
    expect(container.textContent).toContain("Your turn.");
    expect(figure(container).classList.contains("is-open")).toBe(false);
  });

  it("never touches the network to replay a task", async () => {
    const fetchSpy = vi.fn();
    const beaconSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon: beaconSpy });
    render(<Aperture />);

    fireEvent.change(input(), { target: { value: "the stripe webhook drops events" } });
    fireEvent.click(screen.getByRole("button", { name: "Localize" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("3 of 125 files in the Slice."));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  });

  it("hands a task of the visitor's own to the workspace, and keeps the Slice it shows", async () => {
    const { container } = render(<Aperture />);
    const marks = container.querySelectorAll('[data-kind="included"], [data-kind="anchor"]').length;

    fireEvent.change(input(), { target: { value: "rewrite the editor in rust" } });
    fireEvent.click(screen.getByRole("button", { name: "Localize" }));

    const link = await screen.findByRole("link", { name: /Localize it in the workspace/ });
    expect(link.getAttribute("href")).toBe("/workspace?repo=shadcn-ui%2Ftaxonomy&task=rewrite+the+editor+in+rust");
    expect(screen.getByRole("status").textContent).toBe("This task is not recorded. The workspace can localize it.");
    expect(container.querySelectorAll('[data-kind="included"], [data-kind="anchor"]')).toHaveLength(marks);

    fireEvent.change(input(), { target: { value: "rewrite the editor in go" } });
    expect(screen.queryByRole("link", { name: /Localize it in the workspace/ })).toBeNull();
  });

  it("answers a refinement of a Widened task from the record too", async () => {
    render(<Aperture />);

    fireEvent.click(screen.getByRole("button", { name: "kubernetes helm chart rollback" }));
    fireEvent.click(await screen.findByRole("button", { name: "dashboard" }));

    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("41 of 125 files in the Slice."));
    expect(input().value).toBe("kubernetes helm chart rollback dashboard");
  });

  it("does not offer file extensions as words to refine with", async () => {
    const { container } = render(<Aperture />);

    fireEvent.click(screen.getByRole("button", { name: "kubernetes helm chart rollback" }));

    await waitFor(() => expect(container.textContent).toContain("Words this Repo uses"));
    expect(screen.queryByRole("button", { name: "tsx" })).toBeNull();
    expect(screen.getByRole("button", { name: "dashboard" })).toBeTruthy();
  });

  it("says so plainly when a task Widens, instead of showing a small Slice", async () => {
    const { container } = render(<Aperture />);

    fireEvent.click(screen.getByRole("button", { name: "kubernetes helm chart rollback" }));

    await waitFor(() => expect(container.textContent).toContain("No file matched with enough evidence"));
    expect(container.textContent).toContain("kubernetes");
    expect(container.querySelectorAll('[data-kind="excluded"]')).toHaveLength(0);
  });

  it("does not type by itself under reduced motion: the recorded Slice shows at once", () => {
    stubBrowser(true);
    const { container } = render(<Aperture />);

    act(() => observers.forEach((notify) => notify([{ isIntersecting: true }])));

    expect(figure(container).classList.contains("is-open")).toBe(false);
    expect(input().value).toBe(RECORDED_SLICE.task);
    expect(container.textContent).toContain("Your turn.");
  });

  it("disables Localize on an empty task", () => {
    render(<Aperture />);

    fireEvent.change(input(), { target: { value: "   " } });

    expect((screen.getByRole("button", { name: "Localize" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
