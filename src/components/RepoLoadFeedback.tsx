import type { RepoLoadIssue } from "@/hooks/useLocus";

type RepoLoadFeedbackProps = {
  issue: RepoLoadIssue;
  activeRepoName: string | null;
  onRetry: () => void;
  onUseDemo: () => void;
};

export function RepoLoadFeedback({
  issue,
  activeRepoName,
  onRetry,
  onUseDemo,
}: RepoLoadFeedbackProps) {
  return (
    <div role="alert" className="border-t border-failed/25 bg-failed/5 px-5 py-4 text-xs leading-5 text-failed">
      <p className="font-medium">{issue.message}</p>
      {activeRepoName && (
        <p className="mt-1 text-ink-2">{activeRepoName} is still open, so your current Slice was not interrupted.</p>
      )}
      {issue.code === "unavailable" && (
        <p className="mt-1 text-ink-2">Public GitHub Repos only during early access.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {issue.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-chip bg-ink px-3 py-1.5 text-[11px] font-semibold text-canvas transition hover:bg-ink/90"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onUseDemo}
          className="rounded-chip border border-line-2 px-3 py-1.5 text-[11px] text-ink-2 transition hover:border-ink/40 hover:text-ink"
        >
          Open demo Repo
        </button>
      </div>
    </div>
  );
}
