import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { CLERK_PALETTE } from "@/lib/clerk-palette";

function luminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

/** Roles that colour text: each must reach WCAG AA (4.5:1). */
const TEXT_ROLES = ["ink", "ink-2", "muted", "included-ink", "passed", "widened", "failed"];

/**
 * The signal as a mark, ring or fill. A graphic needs 3:1 (WCAG 1.4.11); text
 * in the signal uses --included-ink instead.
 */
function expectSignalGraphic(palette: Record<string, string>) {
  for (const ground of GROUNDS) {
    expect(contrast(palette.included, palette[ground])).toBeGreaterThanOrEqual(3);
  }
}

/** Every ground text can sit on: the page, recessed bands and table heads, cards, wells. */
const GROUNDS = ["canvas", "canvas-2", "surface", "surface-2"];

function expectReadable(palette: Record<string, string>, role: string) {
  for (const ground of GROUNDS) {
    expect(contrast(palette[role], palette[ground]), `${role} on ${ground}`).toBeGreaterThanOrEqual(4.5);
  }
}

/** The hex tokens declared in the first rule whose selector is `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--([a-z\d-]+):\s*(#[a-f\d]{6})/gi)].map(([, name, hex]) => [name, hex]),
  );
}

describe("public color tokens", () => {
  const light = tokens(":root");
  const dark = { ...light, ...tokens('[data-band="dark"]') };

  it("keeps the signal visible as a graphic on light and band grounds", () => {
    expectSignalGraphic(light);
    expectSignalGraphic(dark);
  });

  it.each(TEXT_ROLES)(
    "keeps --%s above WCAG AA contrast on every light ground",
    (role) => {
      expectReadable(light, role);
    },
  );

  it.each(TEXT_ROLES)(
    "keeps --%s above WCAG AA contrast inside a dark band",
    (role) => {
      expectReadable(dark, role);
    },
  );
});

describe("dark theme tokens", () => {
  const light = tokens(":root");
  const theme = { ...light, ...tokens(':root[data-theme="dark"]') };
  // A band element matches the band rule (its own ink values) and the deeper
  // grounds the dark theme gives a band, in that order.
  const band = {
    ...light,
    ...tokens('[data-band="dark"]'),
    ...tokens(':root[data-theme="dark"] [data-band="dark"]'),
  };

  it("keeps the signal visible as a graphic on dark grounds", () => {
    expectSignalGraphic(theme);
    expectSignalGraphic(band);
  });

  it.each(TEXT_ROLES)(
    "keeps --%s above WCAG AA contrast on the dark canvas and surfaces",
    (role) => {
      expectReadable(theme, role);
    },
  );

  it.each(TEXT_ROLES)(
    "keeps --%s above WCAG AA contrast in a band inside the dark theme",
    (role) => {
      expectReadable(band, role);
    },
  );

  // The dark theme is declared twice: once for an explicit choice and once for
  // the system setting. A value changed in one and not the other would make the
  // theme depend on how it was chosen.
  it("declares the same values for the system and the explicit dark theme", () => {
    expect(tokens(':root:not([data-theme="light"])')).toEqual(tokens(':root[data-theme="dark"]'));
    expect(tokens(':root:not([data-theme="light"]) [data-band="dark"]'))
      .toEqual(tokens(':root[data-theme="dark"] [data-band="dark"]'));
    expect(Object.keys(tokens(':root[data-theme="dark"]')).length).toBeGreaterThan(8);
  });
});

describe("Clerk palette", () => {
  const light = tokens(":root");
  const dark = { ...light, ...tokens(':root[data-theme="dark"]') };

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("matches the %s theme tokens", (name, palette) => {
    const clerk = CLERK_PALETTE[name];
    expect(clerk.colorBackground).toBe(palette.surface);
    expect(clerk.colorInputBackground).toBe(palette.canvas);
    expect(clerk.colorText).toBe(palette.ink);
    expect(clerk.colorPrimary).toBe(palette.ink);
    expect(clerk.colorTextOnPrimaryBackground).toBe(palette.canvas);
    expect(clerk.colorTextSecondary).toBe(palette["ink-2"]);
    expect(clerk.colorDanger).toBe(palette.failed);
    expect(clerk.colorSuccess).toBe(palette.passed);
  });
});
