import { monoLabel } from "@/components/controls";
import type { AgentRunSnapshot } from "@/lib/agent/run-view";

/** What a failed Run made but could not publish, with the checks it last ran. */
export function UnpublishedChange({ snapshot }: { snapshot: AgentRunSnapshot }) {
  if (snapshot.run.status !== "failed") return null;
  const diff = snapshot.artifacts.find((artifact) => artifact.kind === "diff")?.content;
  const checks = snapshot.artifacts.find((artifact) => artifact.kind === "test")?.content;
  if (!diff) return null;

  return (
    <section aria-label="Unpublished change" className="overflow-hidden rounded-card border border-line-2">
      <div className="p-4">
        <p className={monoLabel}>Unpublished change</p>
        <p className="mt-1.5 text-[14px] leading-6 text-ink-2">
          What the Agent had when the Run failed. It cannot be accepted or downloaded, and Locus keeps it for 30 days.
        </p>
      </div>
      {[["Check output", checks], ["Diff", diff]].map(([label, content]) => content && (
        <details key={label} className="group border-t border-line">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-ink">
            {label}
            <span aria-hidden className="font-mono text-[12px] text-muted transition-transform duration-150 group-open:rotate-90">›</span>
          </summary>
          <pre className="max-h-80 overflow-auto border-t border-line bg-canvas p-4 font-mono text-[12px] leading-5 text-ink-2" tabIndex={0} aria-label={label ?? undefined}>{content}</pre>
        </details>
      ))}
    </section>
  );
}
