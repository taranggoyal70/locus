import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

  it.each(["ink", "ink-2", "muted", "included", "widened", "failed"])(
    "keeps --%s above WCAG AA contrast on the canvas and on surfaces",
    (role) => {
      expect(contrast(light[role], light.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light[role], light.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["ink", "ink-2", "muted", "included", "widened", "failed"])(
    "keeps --%s above WCAG AA contrast inside a dark band",
    (role) => {
      expect(contrast(dark[role], dark.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark[role], dark.surface)).toBeGreaterThanOrEqual(4.5);
    },
  );
});
