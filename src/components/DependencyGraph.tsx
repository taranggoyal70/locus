"use client";

import { useMemo } from "react";

import { PathText } from "@/components/PathText";
import type { Graph, LocateResult, SliceFile } from "@/lib/types";

type TraceStage = {
  step: string;
  title: string;
  description: string;
  files: SliceFile[];
};

function uniqueFiles(files: SliceFile[]): SliceFile[] {
  return [...new Map(files.map((file) => [file.rel, file])).values()];
}

export function DependencyGraph({
  graph,
  result,
  selected,
  onSelect,
  onRefineTask,
}: {
  graph: Graph;
  result: LocateResult | null;
  selected: string | null;
  onSelect: (rel: string) => void;
  onRefineTask: (term: string) => void;
}) {
  const trace = useMemo(() => {
    if (!result || result.widened) return null;

    const sliceByRel = new Map(result.slice.map((file) => [file.rel, file]));
    const anchorFiles = result.anchors
      .map((rel) => sliceByRel.get(rel))
      .filter((file): file is SliceFile => Boolean(file))
      .slice(0, 4);
    const anchorRels = new Set(anchorFiles.map((file) => file.rel));

    const dependencyRels = new Set<string>();
    for (const anchor of anchorFiles) {
      const node = graph.nodes.find((candidate) => candidate.rel === anchor.rel);
      if (!node) continue;
      for (const path of graph.deps[node.path] ?? []) {
        const rel = graph.byPath[path]?.rel;
        if (rel && sliceByRel.has(rel) && !anchorRels.has(rel)) dependencyRels.add(rel);
      }
      for (const path of graph.rdeps[node.path] ?? []) {
        const rel = graph.byPath[path]?.rel;
        if (rel && sliceByRel.has(rel) && !anchorRels.has(rel)) dependencyRels.add(rel);
      }
    }

    const fallbackDependencies = result.slice.filter((file) => file.dist === 1 && !anchorRels.has(file.rel));
    const dependencyFiles = uniqueFiles([
      ...[...dependencyRels].map((rel) => sliceByRel.get(rel)).filter((file): file is SliceFile => Boolean(file)),
      ...fallbackDependencies,
    ]).slice(0, 4);
    const dependencySet = new Set(dependencyFiles.map((file) => file.rel));
    const integrationFiles = result.slice
      .filter((file) => !anchorRels.has(file.rel) && !dependencySet.has(file.rel))
      .slice(0, 4);

    const stages: TraceStage[] = [
      {
        step: "01",
        title: "Task matches",
        description: "Paths and source text that directly match the task.",
        files: anchorFiles,
      },
      {
        step: "02",
        title: "Imported dependencies",
        description: "Code those entry points call or are called by.",
        files: dependencyFiles,
      },
      {
        step: "03",
        title: "Nearby integration",
        description: "Supporting files kept to preserve the working path.",
        files: integrationFiles,
      },
    ];

    return { stages, shown: new Set(stages.flatMap((stage) => stage.files.map((file) => file.rel))).size };
  }, [graph, result]);

  if (!result || result.widened || !trace) {
    const refinement = result?.refinement;
    const unmatched = refinement?.unmatchedTerms ?? [];
    const candidates = refinement?.candidateFiles ?? [];
    const repositoryTerms = refinement?.repositoryTerms ?? [];

    // Columns follow this panel's own width (container queries), not the
    // viewport's: in the workspace it sits beside the ranked list.
    return (
      <section className="@container min-w-0 overflow-hidden rounded-card border border-line-2 bg-surface">
        <div className="border-b border-line px-6 py-5">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Context trace</p>
          <h2 className="mt-2 font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">
            {result?.widened ? "Locus needs one more detail" : "Describe a task to build the trace"}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-ink-2">
            {result?.widened
              ? unmatched.length > 0
                ? `I couldn’t find ${unmatched.map((term) => `“${term}”`).join(" or ")} in the loaded source. Every file remains included so nothing is silently missed.`
                : "The task did not provide enough file-level evidence. Every file remains included so nothing is silently missed."
              : "Locus will show the task matches, their imported dependencies, and the nearby integration files it keeps for the agent."}
          </p>
        </div>
        {result?.widened ? (
          <div className="grid gap-px bg-line @xl:grid-cols-2">
            <div className="bg-canvas/70 p-5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Make the task specific
              </p>
              <p className="mt-3 text-[14px] leading-6 text-ink-2">
                Add a filename, component, route, function, error message, or stack trace. Locus will recalculate as you type.
              </p>
              {repositoryTerms.length > 0 && (
                <div className="mt-4">
                  <p className="text-[13px] text-muted">Terms found in this repository</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {repositoryTerms.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => onRefineTask(term)}
                        className="rounded-chip border border-line-2 px-2.5 py-1 font-mono text-[12px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
                      >
                        + {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="bg-canvas/70 p-5">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                {candidates.length > 0 ? "Possible starting files" : "No supported match yet"}
              </p>
              {candidates.length > 0 ? (
                <div className="mt-3 border-t border-ink">
                  {candidates.map((file) => (
                    <button
                      key={file}
                      type="button"
                      onClick={() => onSelect(file)}
                      className="block w-full border-b border-line px-2 py-2.5 text-left font-mono text-[12px] text-ink transition-colors duration-150 hover:bg-surface-2/60"
                    >
                      {file}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-[14px] leading-6 text-ink-2">
                  The current task language does not appear in a supported source file. Refine the task before copying context.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-px bg-line @3xl:grid-cols-3">
            {["Task matches", "Imported dependencies", "Nearby integration"].map((title, index) => (
              <div key={title} className="min-h-44 bg-canvas/70 p-5">
                <span className="font-mono text-[11px] text-muted">0{index + 1}</span>
                <p className="mt-8 font-display text-[20px] leading-tight text-ink-2">{title}</p>
                <div className="mt-4 h-px bg-line-2" />
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const hiddenSelected = Math.max(0, result.slice.length - trace.shown);

  return (
    <section className="@container min-w-0 overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 @xl:flex-row @xl:items-end @xl:justify-between">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Context trace</p>
          <h2 className="mt-2 font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">
            How Locus built this context
          </h2>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-ink-2">
            Follow the selection from task evidence to the supporting files sent to the agent.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[12px] tabular-nums">
          <span className="rounded-chip border border-line-2 px-2.5 py-1 text-included-ink">
            {result.slice.length} selected
          </span>
          <span className="rounded-chip border border-line-2 px-2.5 py-1 text-ink-2">
            {result.excluded.length} excluded
          </span>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-8 px-6 py-6 @3xl:grid-cols-3">
        {trace.stages.map((stage) => (
          <div key={stage.step} className="min-w-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-mono text-[11px] font-medium text-ink tabular-nums">{stage.step}</span>
              <span className="font-mono text-[11px] text-muted tabular-nums">
                {stage.files.length} files
              </span>
            </div>
            <h3 className="mt-2 font-display text-[20px] font-normal leading-tight tracking-[-0.01em] text-ink">{stage.title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-ink-2 @3xl:min-h-10">{stage.description}</p>

            <div className="mt-4 border-t border-ink">
              {stage.files.length > 0 ? stage.files.map((file) => {
                const isSelected = selected === file.rel;
                const isAnchor = result.anchors.includes(file.rel);
                return (
                  <button
                    key={file.rel}
                    onClick={() => onSelect(file.rel)}
                    type="button"
                    aria-pressed={isSelected}
                    className={`group w-full border-b border-line px-2 py-2.5 text-left transition-colors duration-150 ${
                      isSelected
                        ? "bg-surface-2 shadow-[inset_2px_0_0_var(--ink)]"
                        : "hover:bg-surface-2/60"
                    }`}
                  >
                    <span className="block font-mono text-[12px] leading-5 text-ink [overflow-wrap:anywhere]">
                      <PathText path={file.rel} />
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-3 font-mono text-[11px]">
                      <span className={isAnchor ? "text-included-ink" : file.recent ? "text-ink" : "text-muted"}>
                        {isAnchor ? "task match" : file.recent ? "recently changed" : `distance ${file.dist}`}
                      </span>
                      <span className="font-mono text-muted">{file.tokens.toLocaleString()} tokens</span>
                    </span>
                  </button>
                );
              }) : (
                <div className="border-b border-line px-2 py-6 text-center text-[13px] text-muted">
                  No additional files needed at this stage.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-6 py-4 text-[13px] text-muted @xl:flex-row @xl:items-center @xl:justify-between">
        <span>Each step shows only the files it directly explains.</span>
        {hiddenSelected > 0 && <span>{hiddenSelected} more Slice {hiddenSelected === 1 ? "file is" : "files are"} in the ranked list.</span>}
      </div>
    </section>
  );
}
