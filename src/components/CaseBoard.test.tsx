// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import hero from "../../assets/readme/hero-run.json";
import results from "../../benchmarks/heldout/results.json";
import { CaseBoard, MARKS, markRuns } from "@/components/CaseBoard";
import { BENCHMARK_CASES, BENCHMARK_SUMMARY, FEATURED_COMMIT, type BenchmarkCase } from "@/lib/benchmark-cases";

const board = () => <CaseBoard cases={BENCHMARK_CASES} featured={FEATURED_COMMIT} />;
const featured = BENCHMARK_CASES.find((item) => item.commit === FEATURED_COMMIT)!;
const repos = [...new Set(BENCHMARK_CASES.map((item) => item.repo))];
const casesOf = (repo: string) => BENCHMARK_CASES.filter((item) => item.repo === repo);

const tabs = () => screen.getAllByRole("tab");
const rows = () => within(screen.getByRole("tabpanel")).getAllByRole("button");
const details = () => screen.getByRole("complementary", { name: "Case details" });
const heading = () => within(details()).getByRole("heading").textContent;

/** Each row's mark runs, as [kind, number of marks]. */
const runsOf = (root: ParentNode) =>
  [...root.querySelectorAll("li > button .case-strip")].map((strip) =>
    [...strip.children].map((run) => {
      expect(run.className).toBe("case-run");
      return [run.getAttribute("data-kind"), Number((run as HTMLElement).style.getPropertyValue("--n"))] as const;
    }),
  );
const marksOf = (runs: ReadonlyArray<readonly [string | null, number]>, kind: string) =>
  runs.find(([runKind]) => runKind === kind)?.[1] ?? 0;

describe("the benchmark case board", () => {
  afterEach(cleanup);

  it("reads every case from the checked-in held-out benchmark, so the page cannot drift from it", () => {
    expect(BENCHMARK_CASES).toHaveLength(results.results.length);
    expect(BENCHMARK_SUMMARY.cases).toBe(results.summary.cases);
    expect(BENCHMARK_SUMMARY.repositories).toBe(results.summary.repositories);
    expect(BENCHMARK_SUMMARY.medianContextReductionPct).toBe(results.summary.localized.medianContextReductionPct);
    expect(BENCHMARK_SUMMARY.chanceRecallPct).toBe(Math.round(results.summary.localized.chanceFixFileRecall * 100));
    for (const [index, item] of BENCHMARK_CASES.entries()) {
      const result = results.results[index];
      expect([item.admitted, item.total]).toEqual([result.sliceFiles, result.repositoryFiles]);
      expect(item.fixFiles).toEqual(result.expected);
      expect(item.found).toEqual(result.found);
    }
    // The board opens on the run the README's hero replays.
    expect([featured.repo, featured.commit]).toEqual([hero.repo, hero.commit]);
  });

  it("gives every case a hundred marks, one per percent of its Repo, and never rounds a kind away", () => {
    for (const item of BENCHMARK_CASES) {
      const runs = markRuns(item);
      const outside = item.total - item.admitted - (item.fixFiles.length - item.found.length);
      expect(runs.length).toBeLessThanOrEqual(4);
      expect(runs.reduce((sum, [, n]) => sum + n, 0)).toBe(MARKS);
      expect(runs[0][0]).toBe("fix");
      expect(runs[0][1]).toBeGreaterThanOrEqual(1);
      expect(marksOf(runs, "excluded") > 0).toBe(outside > 0);
      // Within a mark of the true share of the Repo that the Slice holds.
      const slice = marksOf(runs, "fix") + marksOf(runs, "admitted");
      expect(Math.abs(slice - (item.admitted / item.total) * MARKS)).toBeLessThanOrEqual(1.5);
    }
  });

  it("opens on the featured case in its Repo's tab, drawn the same on the server", () => {
    const { container } = render(board());
    const server = document.createElement("div");
    server.innerHTML = renderToStaticMarkup(board());

    expect(heading()).toBe(featured.task);
    expect(tabs().map((tab) => tab.textContent)).toEqual(repos.map((repo) => repo.split("/")[1]));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe(featured.repo.split("/")[1]);
    expect(rows()).toHaveLength(casesOf(featured.repo).length);
    expect((container.querySelector(".case-list") as HTMLElement).style.getPropertyValue("--scale")).toBe(String(MARKS));
    for (const root of [container, server]) {
      expect(runsOf(root)).toEqual(casesOf(featured.repo).map((item) => markRuns(item)));
    }
  });

  it("steps through the Repos on the tabs, and the cases of one in the list", () => {
    render(board());
    const first = tabs()[0];

    fireEvent.click(first);
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(first.tabIndex).toBe(0);
    expect(heading()).toBe(casesOf(repos[0])[0].task);

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs()[1]);
    expect(heading()).toBe(casesOf(repos[1])[0].task);
    fireEvent.keyDown(tabs()[1], { key: "End" });
    expect(document.activeElement).toBe(tabs()[repos.length - 1]);
    fireEvent.keyDown(tabs()[repos.length - 1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs()[0]);
    expect(tabs().filter((tab) => tab.tabIndex === 0)).toHaveLength(1);

    const buttons = rows();
    const cases = casesOf(repos[0]);
    fireEvent.pointerEnter(buttons[2], { pointerType: "mouse" });
    expect(heading()).toBe(cases[2].task);
    expect(buttons[2].getAttribute("aria-expanded")).toBe("true");
    // A touch passing over a row does not select it; a tap does.
    fireEvent.pointerEnter(buttons[4], { pointerType: "touch" });
    expect(heading()).toBe(cases[2].task);
    fireEvent.click(buttons[4]);
    expect(heading()).toBe(cases[4].task);

    buttons[4].focus();
    fireEvent.keyDown(buttons[4], { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[5]);
    expect(heading()).toBe(cases[5].task);
    fireEvent.keyDown(buttons[5], { key: "End" });
    expect(document.activeElement).toBe(buttons[cases.length - 1]);
    fireEvent.keyDown(buttons[cases.length - 1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[cases.length - 1]);
  });

  it("names every row with its numbers, and links each case to its commits in the public Repo", () => {
    render(board());
    const item = casesOf(featured.repo)[3];
    const row = within(screen.getByRole("tabpanel")).getByRole("button", { name: new RegExp(item.task) });
    expect(row.textContent).toContain(`${item.admitted} of ${item.total} files admitted`);
    expect(row.textContent).toContain(`${item.found.length} of ${item.fixFiles.length} fix files found`);

    fireEvent.click(row);
    const links = within(details()).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      `https://github.com/${item.repo}/commit/${item.commit}`,
      `https://github.com/${item.repo}/tree/${item.snapshot}`,
    ]);
  });

  it("shows where a task came from, the random baseline, and the case without its scope word", () => {
    render(board());
    const text = details().textContent;

    expect(text).toContain(featured.subject);
    expect(text).toContain(`A random Slice of ${featured.admitted} files would hold each fix file ${featured.chancePct}% of the time.`);
    expect(featured.withoutScope.task).not.toBe(featured.task);
    expect(text).toContain("Scope word removed");
    expect(text).toContain(featured.withoutScope.task);
  });

  it("says plainly when a case Widened, and that a whole-Repo fallback finds every fix file by definition", () => {
    const widened = BENCHMARK_CASES.find((item) => item.widened)!;
    render(<CaseBoard cases={BENCHMARK_CASES} featured={widened.commit} />);

    expect(details().textContent).toContain("admitted the whole Repo instead of guessing");
    expect(details().textContent).toContain("contains every fix file by definition");
    expect(details().textContent).not.toContain("A random Slice");
    expect(markRuns(widened).map(([kind]) => kind)).not.toContain("excluded");
  });

  it("marks a fix file the Slice missed instead of hiding it, and keys it only when one exists", () => {
    render(board());
    expect(screen.queryByText("Missed by the Slice")).toBeNull();
    cleanup();

    const missed: BenchmarkCase = { ...featured, fixFiles: [...featured.fixFiles, "src/missing.ts"] };
    const { container } = render(<CaseBoard cases={[missed]} />);
    const [row] = runsOf(container);
    expect(row.map(([kind]) => kind)).toEqual(["fix", "admitted", "missed", "excluded"]);
    expect(marksOf(row, "missed")).toBe(1);
    expect(row.reduce((sum, [, n]) => sum + n, 0)).toBe(MARKS);
    expect(screen.getByText("Missed by the Slice")).toBeTruthy();
    expect(details().textContent).toContain("missed by the Slice");
  });
});
