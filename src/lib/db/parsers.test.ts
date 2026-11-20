import { describe, expect, it } from "vitest";

import { isoTimestamp } from "@/lib/db/parsers";
import { createTestDatabase } from "@/test/database";

describe("isoTimestamp", () => {
  it.each([
    ["2026-11-19 23:39:12.123456+00", "2026-11-19T23:39:12.123456+00:00"],
    ["2026-11-19 23:39:12+00", "2026-11-19T23:39:12+00:00"],
    ["2026-11-19 18:09:12.5+05:30", "2026-11-19T18:09:12.5+05:30"],
    ["infinity", "infinity"],
  ])("turns %s into %s", (input, output) => {
    expect(isoTimestamp(input)).toBe(output);
    if (input !== "infinity") expect(Number.isNaN(Date.parse(output))).toBe(false);
  });
});

describe("result shapes", () => {
  // Routes, stored payloads and the public API were written against JSON from
  // the old database API. These are the shapes they expect, read back through
  // the same parsers the production client installs.
  it("returns timestamps as ISO strings with full precision, dates as text, and bigint as a number", async () => {
    const database = await createTestDatabase();
    try {
      const { rows } = await database.pglite.query<Record<string, unknown>>(`
        select '2026-11-19 23:39:12.123456+00'::timestamptz as at,
               '2026-11-19'::date as day,
               9007199254740991::bigint as big,
               count(*) as counted
        from (values (1), (2)) as v(x)`);

      expect(rows[0]).toEqual({
        at: "2026-11-19T23:39:12.123456+00:00",
        day: "2026-11-19",
        big: 9007199254740991,
        counted: 2,
      });
    } finally {
      await database.destroy();
    }
  });

  it("refuses a bigint that would lose precision as a number", async () => {
    const database = await createTestDatabase();
    try {
      await expect(database.pglite.query("select 9007199254740993::bigint as big")).rejects.toThrow(RangeError);
    } finally {
      await database.destroy();
    }
  });
});
