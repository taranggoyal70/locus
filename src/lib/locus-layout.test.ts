import { describe, expect, it } from "vitest";

import { FILES, GRID, LOCALIZATIONS, point, RIM } from "@/lib/locus-layout";

describe("the Locus figure's layout", () => {
  it("gives every file exactly one place in every localization", () => {
    expect(GRID).toHaveLength(FILES.length);
    for (const { places } of LOCALIZATIONS) expect(places).toHaveLength(FILES.length);
  });

  it("puts the Slice inside the rim and everything left out on it", () => {
    for (const { places, inSlice, widened } of LOCALIZATIONS) {
      const onRim = places.filter(({ hop }) => hop === -1);
      expect(onRim.every(({ radius }) => radius === RIM)).toBe(true);
      expect(places.length - onRim.length).toBe(inSlice);
      if (widened) expect(onRim).toHaveLength(0);
    }
  });

  it("never puts one mark on top of another", () => {
    for (const { places } of LOCALIZATIONS) {
      const points = places.map(point);
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(14);
        }
      }
    }
  });

  it("counts the rings it draws", () => {
    for (const { perHop, inSlice, widened } of LOCALIZATIONS) {
      if (!widened) expect(perHop.reduce((a, b) => a + b, 0)).toBe(inSlice);
    }
  });
});
