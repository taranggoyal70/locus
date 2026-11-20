// How result values arrive in JavaScript. Every route, workflow step and stored
// payload was written against the database API Locus used before it moved to
// plain PostgreSQL, which returned JSON: timestamps as ISO-8601 strings, dates as
// "YYYY-MM-DD", bigint as a number. node-postgres would instead hand back Date
// objects (losing microseconds, and turning a date into local midnight) and
// bigint as a string. These parsers keep the old shapes so nothing downstream
// changes meaning, and src/lib/db/schema.ts is generated to the same contract.

const TIMESTAMPTZ = 1184;
const TIMESTAMP = 1114;
const DATE = 1082;
const INT8 = 20;

/**
 * PostgreSQL's text form ("2026-11-19 23:39:12.123456+00") as ISO-8601
 * ("2026-11-19T23:39:12.123456+00:00"), keeping every digit of precision.
 */
export function isoTimestamp(value: string): string {
  if (value === "infinity" || value === "-infinity") return value;
  const iso = value.replace(" ", "T");
  return iso.replace(/([+-]\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/, (_, hours: string, minutes?: string, seconds?: string) =>
    `${hours}:${minutes ?? "00"}${seconds ? `:${seconds}` : ""}`);
}

function safeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new RangeError(`bigint ${value} does not fit in a JavaScript number`);
  }
  return parsed;
}

export const RESULT_PARSERS: Readonly<Record<number, (value: string) => unknown>> = {
  [TIMESTAMPTZ]: isoTimestamp,
  [TIMESTAMP]: (value) => value.replace(" ", "T"),
  [DATE]: (value) => value,
  [INT8]: safeInteger,
};
