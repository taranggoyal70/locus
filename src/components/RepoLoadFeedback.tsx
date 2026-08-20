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
    <div role="alert" className="border-t border-recent/25 bg-recent/5 px-5 py-4 text-xs leading-5 text-recent">
      <p className="font-medium">{issue.message}</p>
      {activeRepoName && (
        <p className="mt-1 text-muted-light">{activeRepoName} is still open, so your current Slice was not interrupted.</p>
      )}
      {issue.code === "unavailable" && (
        <p className="mt-1 text-muted-light">Public GitHub Repos only during the controlled alpha.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {issue.retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-paper px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-accent"
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onUseDemo}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-[11px] text-muted-light transition hover:border-accent hover:text-paper"
        >
          Open demo Repo
        </button>
      </div>
    </div>
  );
}
