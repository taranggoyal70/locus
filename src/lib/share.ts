export type SharedWorkspaceView = {
  repositorySpecifier: string;
  task: string;
};

type SearchParams = Record<string, string | string[] | undefined>;

export function sharedWorkspaceViewFrom(params: SearchParams | URLSearchParams): SharedWorkspaceView | null {
  const repositoryValue = params instanceof URLSearchParams ? params.get("repo") : params.repo;
  const taskValue = params instanceof URLSearchParams ? params.get("task") : params.task;
  const repositorySpecifier = typeof repositoryValue === "string" ? repositoryValue : undefined;
  const task = typeof taskValue === "string" ? taskValue : undefined;
  return repositorySpecifier && task ? { repositorySpecifier, task } : null;
}

export function buildWorkspacePath(view: SharedWorkspaceView): string {
  const query = new URLSearchParams({
    repo: view.repositorySpecifier.trim(),
    task: view.task.trim(),
  });
  return `/workspace?${query.toString()}`;
}

export function buildShareUrl(origin: string, view: SharedWorkspaceView): string {
  const url = new URL(buildWorkspacePath(view), origin);
  return url.toString();
}
