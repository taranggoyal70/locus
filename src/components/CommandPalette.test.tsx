// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette } from "@/components/CommandPalette";

// jsdom has no modal dialogs or scrolling; these stand-ins keep the same contract.
function stubDialog() {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  Element.prototype.scrollIntoView = function scrollIntoView() {};
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
}

const dialog = () => document.querySelector("dialog.palette") as HTMLDialogElement;
const input = () => screen.getByRole("combobox");
const options = () => screen.queryAllByRole("option");

function openWith(key: { metaKey?: boolean; ctrlKey?: boolean }) {
  act(() => {
    fireEvent.keyDown(window, { key: "k", ...key });
  });
}

function search(text: string) {
  fireEvent.change(input(), { target: { value: text } });
}

describe("the command menu", () => {
  beforeEach(stubDialog);

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("renders only its Search button on the server, so the page carries none of its contents", () => {
    const html = renderToStaticMarkup(<CommandPalette />);
    expect(html).toContain("Search");
    expect(html).toContain('aria-keyshortcuts="Meta+K Control+K"');
    expect(html).not.toContain("Ask Locus");
    expect(html).not.toContain("Does Locus write");
  });

  it("opens with ⌘K or Ctrl+K, toggles shut with the same keys, and resets when it closes", () => {
    render(<CommandPalette />);
    expect(dialog().open).toBe(false);

    openWith({ metaKey: true });
    expect(dialog().open).toBe(true);
    search("docs");
    openWith({ ctrlKey: true });
    expect(dialog().open).toBe(false);

    openWith({ ctrlKey: true });
    expect((input() as HTMLInputElement).value).toBe("");
    expect(options().length).toBeGreaterThan(20);
  });

  it("filters on every word, including words that are never shown", () => {
    render(<CommandPalette />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    search("api key");
    expect(options().map((option) => option.textContent)).toEqual(["§Authentication"]);
    search("nothing like this");
    expect(options()).toHaveLength(0);
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("moves through the options with the arrow keys, wrapping at both ends", () => {
    render(<CommandPalette />);
    openWith({ metaKey: true });
    const first = options()[0];
    expect(input().getAttribute("aria-activedescendant")).toBe(first.id);

    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(input().getAttribute("aria-activedescendant")).toBe(options().at(-1)?.id);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().getAttribute("aria-activedescendant")).toBe(first.id);
    expect(first.getAttribute("aria-selected")).toBe("true");
  });

  it("answers a question in place, from copy the site already publishes", () => {
    render(<CommandPalette />);
    openWith({ metaKey: true });
    search("write");
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain("Localizing a Repo needs no repository write access");
    expect(screen.getByRole("link", { name: "Read the privacy page" }).getAttribute("href")).toBe("/privacy");
  });

  it("switches the theme and closes", () => {
    render(<CommandPalette />);
    openWith({ metaKey: true });
    search("dark theme");
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("locus-theme")).toBe("dark");
    expect(dialog().open).toBe(false);
  });

  it("goes to pages through real links, so they route like any click", () => {
    render(<CommandPalette />);
    openWith({ metaKey: true });
    search("docs");
    const docs = options().find((option) => option.textContent?.endsWith("Docs3"));
    expect(docs?.tagName).toBe("A");
    expect(docs?.getAttribute("href")).toBe("/docs");
    expect(docs?.getAttribute("tabindex")).toBe("-1");
  });

  it("scrolls to a section of this page and moves focus to it", () => {
    const section = document.createElement("section");
    section.id = "evidence";
    document.body.append(section);
    render(<CommandPalette />);
    openWith({ metaKey: true });
    search("benchmark");
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(dialog().open).toBe(false);
    expect(window.location.hash).toBe("#evidence");
    expect(document.activeElement).toBe(section);
    section.remove();
  });
});
