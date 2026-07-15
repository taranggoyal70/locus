"use client";

import { useMemo } from "react";

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
}: {
  graph: Graph;
  result: LocateResult | null;
  selected: string | null;
  onSelect: (rel: string) => void;
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
    return (
      <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
        <div className="border-b border-line px-6 py-5">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Context trace</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-paper">
            {result?.widened ? "Locus widened to the whole repository" : "Describe a task to build the trace"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
            {result?.widened
              ? "The task did not provide enough file-level evidence, so Locus kept every file instead of returning a speculative slice."
              : "Locus will show the task matches, their imported dependencies, and the nearby integration files it keeps for the agent."}
          </p>
        </div>
        <div className="grid gap-px bg-line md:grid-cols-3">
          {["Task matches", "Imported dependencies", "Nearby integration"].map((title, index) => (
            <div key={title} className="min-h-44 bg-ink/70 p-5">
              <span className="font-mono text-xs text-muted">0{index + 1}</span>
              <p className="mt-8 text-sm font-medium text-muted-light">{title}</p>
              <div className="mt-4 h-px bg-line-strong" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const hiddenSelected = Math.max(0, result.slice.length - trace.shown);

  return (
    <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface shadow-[0_30px_100px_rgba(0,0,0,0.2)]">
      <div className="flex flex-col gap-4 border-b border-line px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Context trace</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-paper">How Locus built this context</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-light">
            Follow the selection from task evidence to the supporting files sent to the agent.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full border border-accent/25 bg-accent/[0.08] px-3 py-1.5 font-mono text-accent">
            {result.slice.length} selected
          </span>
          <span className="rounded-full border border-line-strong px-3 py-1.5 font-mono text-muted-light">
            {result.excluded.length} excluded
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-line lg:grid-cols-3">
        {trace.stages.map((stage) => (
          <div key={stage.step} className="min-w-0 bg-ink/[0.72] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs font-semibold text-accent">{stage.step}</p>
                <h3 className="mt-2 text-sm font-semibold text-paper">{stage.title}</h3>
              </div>
              <span className="rounded-full border border-line px-2 py-1 font-mono text-[10px] text-muted">
                {stage.files.length} files
              </span>
            </div>
            <p className="mt-2 min-h-10 text-xs leading-5 text-muted">{stage.description}</p>

            <div className="mt-5 space-y-2">
              {stage.files.length > 0 ? stage.files.map((file) => {
                const isSelected = selected === file.rel;
                const isAnchor = result.anchors.includes(file.rel);
                return (
                  <button
                    key={file.rel}
                    onClick={() => onSelect(file.rel)}
                    className={`group w-full rounded-xl border p-3 text-left transition ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-line bg-surface/70 hover:border-line-strong hover:bg-surface-raised"
                    }`}
                  >
                    <span className="block break-all font-mono text-[11px] leading-5 text-paper">{file.rel}</span>
                    <span className="mt-2 flex items-center justify-between gap-3 text-[10px]">
                      <span className={isAnchor ? "text-accent" : file.recent ? "text-recent" : "text-muted"}>
                        {isAnchor ? "task match" : file.recent ? "recently changed" : `distance ${file.dist}`}
                      </span>
                      <span className="font-mono text-muted">{file.tokens.toLocaleString()} tokens</span>
                    </span>
                  </button>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">
                  No additional files needed at this stage.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-line px-6 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>Only direct, explainable stages are shown—no connector wall.</span>
        {hiddenSelected > 0 && <span>{hiddenSelected} additional selected files remain in the ranked list.</span>}
      </div>
    </section>
  );
}
