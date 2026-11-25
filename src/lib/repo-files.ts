import { SOURCE_EXT_RE } from "@/lib/localizer";

/**
 * Directories a hosted Repo read never loads: installed dependencies, build
 * output, coverage, VCS internals, and recorded fixtures or snapshots.
 *
 * Shared by the workspace preview (`/api/github`) and the Agent Run
 * (`fetchAgentRepository`) so the Slice a user previews is built from the same
 * files the Run records as Included and Excluded. Test directories are read on
 * purpose: the Run's file set is also the trusted base the agent may change, and
 * many Repos, most Python ones among them, keep their tests in `tests/`.
 */
export const IGNORED_REPO_DIRECTORY_RE =
  /(^|\/)(node_modules|\.next|dist|build|coverage|\.git|vendor|fixtures?|snapshots?)\//i;

export function isIgnoredRepoPath(path: string): boolean {
  return IGNORED_REPO_DIRECTORY_RE.test(path);
}

/** A file that becomes a node in the localization Graph. */
export function isGraphSourcePath(path: string): boolean {
  return SOURCE_EXT_RE.test(path) && !isIgnoredRepoPath(path);
}
