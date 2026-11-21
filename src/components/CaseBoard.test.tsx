// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import results from "../../benchmarks/results.json";
import { CaseBoard } from "@/components/CaseBoard";
import { BENCHMARK_CASES, BENCHMARK_SUMMARY } from "@/lib/benchmark-cases";

// The board's only buttons are its rows, in reading order.
const rows = () => screen.getAllByRole("button");
const details = () => screen.getByRole("complementary", { name: "Case details" });

/** Each row's mark runs, as [kind, number of marks]. */
const runsOf = (root: ParentNode) =>
  [...root.querySelectorAll("li > button .case-strip")].map((strip) =>
    [...strip.children].map((run) => {
      expect(run.className).toBe("case-run");
      return [run.getAttribute("data-kind"), Number((run as HTMLElement).style.getPropertyValue("--n"))] as const;
    }),
  );

describe("the benchmark case board", () => {
  afterEach(cleanup);

  it("reads every case from the checked-in benchmark, so the page cannot drift from it", () => {
    expect(BENCHMARK_CASES).toHaveLength(results.results.length);
    expect(BENCHMARK_SUMMARY.cases).toBe(results.summary.cases);
    expect(BENCHMARK_SUMMARY.medianContextReductionPct).toBe(results.summary.medianContextReductionPct);
    for (const [index, item] of BENCHMARK_CASES.entries()) {
      expect(`${item.admitted}/${item.total}`).toBe(results.results[index].files);
      expect(item.fixFiles).toEqual(results.results[index].expected);
    }
  });

  it("draws one mark per source file, the fix's files first, on one scale for every row", () => {
    const { container } = render(<CaseBoard cases={BENCHMARK_CASES} />);
    const scale = Math.max(...BENCHMARK_CASES.map((item) => item.total));
    expect((container.querySelector(".case-list") as HTMLElement).style.getPropertyValue("--scale")).toBe(String(scale));

    // Server-rendered whole: the board is complete before any script runs.
    const server = document.createElement("div");
    server.innerHTML = renderToStaticMarkup(<CaseBoard cases={BENCHMARK_CASES} />);

    for (const root of [container, server]) {
      const runs = runsOf(root);
      expect(runs).toHaveLength(BENCHMARK_CASES.length);
      runs.forEach((row, index) => {
        const item = BENCHMARK_CASES[index];
        const count = (kind: string) => row.find(([runKind]) => runKind === kind)?.[1] ?? 0;
        // At most four elements a row, whatever the Repo's size.
        expect(row.length).toBeLessThanOrEqual(4);
        expect(row.reduce((sum, [, n]) => sum + n, 0)).toBe(item.total);
        expect(row[0]).toEqual(["fix", item.found.length]);
        expect(count("fix") + count("admitted")).toBe(item.admitted);
        expect(count("missed")).toBe(0);
      });
    }
  });

  it("opens on the featured case and inspects whichever row is hovered, clicked, or reached by keyboard", () => {
    render(<CaseBoard cases={BENCHMARK_CASES} />);
    const featured = BENCHMARK_CASES.find((item) => item.featured);
    expect(featured).toBeDefined();
    expect(within(details()).getByRole("heading").textContent).toBe(featured?.task);

    const buttons = rows();
    fireEvent.pointerEnter(buttons[0], { pointerType: "mouse" });
    expect(within(details()).getByRole("heading").textContent).toBe(BENCHMARK_CASES[0].task);
    expect(buttons[0].getAttribute("aria-expanded")).toBe("true");

    // A touch passing over a row does not select it; a tap does.
    fireEvent.pointerEnter(buttons[4], { pointerType: "touch" });
    expect(within(details()).getByRole("heading").textContent).toBe(BENCHMARK_CASES[0].task);
    fireEvent.click(buttons[4]);
    expect(within(details()).getByRole("heading").textContent).toBe(BENCHMARK_CASES[4].task);

    buttons[4].focus();
    fireEvent.keyDown(buttons[4], { key: "ArrowDown" });
    expect(document.activeElement).toBe(buttons[5]);
    expect(within(details()).getByRole("heading").textContent).toBe(BENCHMARK_CASES[5].task);
    fireEvent.keyDown(buttons[5], { key: "End" });
    expect(document.activeElement).toBe(buttons[BENCHMARK_CASES.length - 1]);
  });

  it("names every row with its numbers, and links each case to its real commits", () => {
    render(<CaseBoard cases={BENCHMARK_CASES} />);
    const item = BENCHMARK_CASES[3];
    const row = screen.getByRole("button", { name: new RegExp(item.task) });
    expect(row.textContent).toContain(`${item.admitted} of ${item.total} files admitted`);
    expect(row.textContent).toContain(`${item.found.length} of ${item.fixFiles.length} fix files found`);

    fireEvent.click(row);
    const links = within(details()).getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      `https://github.com/${item.repo}/commit/${item.commit}`,
      `https://github.com/${item.repo}/tree/${item.snapshot}`,
    ]);
  });

  it("says plainly when a case Widened, and that a whole-Repo fallback finds every fix file by definition", () => {
    render(<CaseBoard cases={BENCHMARK_CASES} />);
    const widened = BENCHMARK_CASES.find((item) => item.widened);
    expect(widened).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(widened?.task ?? "") }));
    expect(details().textContent).toContain("admitted the whole Repo instead of guessing");
    expect(details().textContent).toContain("contains every fix file by definition");
  });

  it("marks a fix file the Slice missed instead of hiding it, and keys it only when one exists", () => {
    render(<CaseBoard cases={BENCHMARK_CASES} />);
    expect(screen.queryByText("Missed by the Slice")).toBeNull();
    cleanup();

    const [first] = BENCHMARK_CASES;
    const missed = { ...first, fixFiles: [...first.fixFiles, "src/missing.ts"], featured: true };
    const { container } = render(<CaseBoard cases={[missed]} />);
    const [row] = runsOf(container);
    expect(row.map(([kind]) => kind)).toEqual(["fix", "admitted", "missed", "excluded"].filter((kind) => row.some(([runKind]) => runKind === kind)));
    expect(row.find(([kind]) => kind === "missed")?.[1]).toBe(1);
    expect(row.reduce((sum, [, n]) => sum + n, 0)).toBe(first.total);
    expect(screen.getByText("Missed by the Slice")).toBeTruthy();
    expect(details().textContent).toContain("missed by the Slice");
  });
});
