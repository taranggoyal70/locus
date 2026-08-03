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

describe("public color tokens", () => {
  it("keeps muted and error text above WCAG AA contrast on the primary canvas", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
    const background = css.match(/--ink:\s*(#[a-f\d]{6})/i)?.[1] ?? "";
    const muted = css.match(/--muted:\s*(#[a-f\d]{6})/i)?.[1] ?? "";
    const recent = css.match(/--recent:\s*(#[a-f\d]{6})/i)?.[1] ?? "";

    expect(contrast(muted, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(recent, background)).toBeGreaterThanOrEqual(4.5);
  });
});
