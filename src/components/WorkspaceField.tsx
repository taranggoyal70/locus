import { FileField, filesPerMark, markColumns, repoColumns } from "@/components/FileField";

/**
 * The workspace's view of the loaded Repo: the same file field as Fig. 1 on the
 * landing page, drawn from the user's own Repo and Slice. Open (every file
 * under a neutral cover) until a Slice exists; the field scans while work is
 * actually running and stops the moment it finishes.
 */
export function WorkspaceField({
  files,
  slicePaths,
  anchorPaths,
  loading,
  repoName,
  includedShare,
}: {
  files: string[] | null;
  slicePaths: string[];
  anchorPaths: string[];
  loading: boolean;
  repoName: string | null;
  includedShare: number;
}) {
  const hasSlice = slicePaths.length > 0;
  const perMark = files ? filesPerMark(files.length) : 1;
  const columns = files
    ? markColumns(repoColumns(files), new Set(slicePaths), new Set(anchorPaths), perMark)
    : [];

  return (
    <section
      aria-label={
        files
          ? `${repoName ?? "Repo"}: ${hasSlice ? `${slicePaths.length} of ${files.length} files in the Slice` : `${files.length} files loaded`}`
          : "No Repo loaded"
      }
      className={`aperture ${hasSlice ? "" : "is-open"} ${loading ? "is-scanning" : ""} overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel`}
    >
      <div className="flex items-start justify-between gap-6 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">{loading ? "Working" : hasSlice ? "Slice" : "Repo"}</p>
          <p className="mt-1.5 truncate text-[15px] font-medium text-ink">{repoName ?? "Load a public Repo to begin"}</p>
        </div>
        {files && (
          <p className="shrink-0 text-right">
            <span className="text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
              {hasSlice ? slicePaths.length : files.length}
              {hasSlice && <span className="text-sm font-medium tracking-normal text-muted"> / {files.length}</span>}
            </span>
            <span className="block font-mono text-[11px] text-muted">files</span>
          </p>
        )}
      </div>

      <div className="px-5 py-5">
        {files ? (
          <FileField columns={columns} />
        ) : (
          <p className="py-10 text-center text-sm text-muted">Every file in the Repo appears here, one mark each.</p>
        )}
      </div>

      {files && (
        <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-line px-5 py-3 font-mono text-[11px] text-muted">
          <span>{perMark > 1 ? `One mark per ${perMark} files` : "One mark per file"}</span>
          {hasSlice && <span className="tabular-nums">{includedShare}% of Repo tokens in the Slice</span>}
        </p>
      )}
    </section>
  );
}
