import { describe, expect, it } from "vitest";

import { isFixSubject, isTestPath, summarize, taskFromSubject } from "./benchmark-heldout.mjs";

describe("held-out case selection", () => {
  it.each([
    ["fix: handle empty body", true],
    ["fix(cookie): reject a lone quote", true],
    ["fix!: drop legacy option", true],
    ["Fix retry on abort", true],
    ["fixture: add sample", false],
    ["feat: add retry", false],
    ["chore: fix typo", false],
  ])("reads %j as a fix: %s", (subject, expected) => {
    expect(isFixSubject(subject)).toBe(expected);
  });

  it.each([
    ["src/utils/cookie.test.ts", true],
    ["src/utils/cookie.spec.tsx", true],
    ["src/types.test-d.ts", true],
    ["packages/server/test/router.ts", true],
    ["src/__tests__/store.ts", true],
    ["src/utils/cookie.ts", false],
    ["src/testing/helpers.ts", false],
  ])("classifies %s as a test file: %s", (file, expected) => {
    expect(isTestPath(file)).toBe(expected);
  });
});

describe("task text from a commit subject", () => {
  it("drops the keyword and keeps the scope as plain words", () => {
    expect(taskFromSubject("fix(jsx/dom): keep a falsy Suspense fallback (#4512)"))
      .toBe("jsx dom keep a falsy Suspense fallback");
  });

  it("removes the scope for the ablation", () => {
    expect(taskFromSubject("fix(jsx/dom): keep a falsy Suspense fallback (#4512)", { keepScope: false }))
      .toBe("keep a falsy Suspense fallback");
  });

  it("handles an unscoped, capitalised subject", () => {
    expect(taskFromSubject("Fix UTF-8 decoding of JSON error responses")).toBe("UTF-8 decoding of JSON error responses");
  });
});

describe("held-out summary", () => {
  const result = (overrides) => ({
    repo: "a/b",
    expected: ["x.ts"],
    found: ["x.ts"],
    widened: false,
    contextReductionPct: 50,
    chanceRecall: 0.25,
    sliceTokens: 100,
    repositoryTokens: 400,
    ...overrides,
  });

  it("separates widened cases from the localized ones", () => {
    const summary = summarize([
      result({}),
      result({ expected: ["x.ts", "y.ts"], found: ["x.ts"], contextReductionPct: 80 }),
      result({ widened: true, contextReductionPct: 0, chanceRecall: 1 }),
    ]);

    expect(summary.cases).toBe(3);
    expect(summary.fixFileRecall).toBe(3 / 4);
    expect(summary.casesWithFullRecall).toBe(2);
    expect(summary.widenedCases).toBe(1);
    expect(summary.medianContextReductionPct).toBe(50);
    expect(summary.localized).toMatchObject({
      cases: 2,
      fixFileRecall: 2 / 3,
      casesWithFullRecall: 1,
      medianContextReductionPct: 65,
      meanChanceRecall: 0.25,
    });
  });
});
