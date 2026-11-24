import { primaryButton, secondaryButton } from "@/components/controls";
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
    <div role="alert" className="border-t border-failed/25 bg-failed/5 px-5 py-4 text-[13px] leading-5 text-failed">
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
            className={primaryButton}
          >
            Retry
          </button>
        )}
        <button
          type="button"
          onClick={onUseDemo}
          className={secondaryButton}
        >
          Open demo Repo
        </button>
      </div>
    </div>
  );
}
