/**
 * The tasks the home page demo offers, and the refinements it offers when one
 * Widens. Any other task works too: the demo runs the real localizer in the
 * visitor's tab (landing-engine.ts).
 */
export const LANDING_REPO = "shadcn-ui/taxonomy";

/** The same limit as POST /api/v1/locate. */
export const MAX_TASK_LENGTH = 1000;

/** The tasks offered as buttons under the demo. */
export const TRY_TASKS = ["the stripe webhook drops events", "fix the dashboard billing", "kubernetes helm chart rollback"] as const;

// The Repo's commonest words include file extensions, which refine nothing.
const FILE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "css", "json", "md", "mdx"]);

/** The words a Widened Slice offers as buttons, to refine the task with. */
export function refinementTerms(repositoryTerms: readonly string[]): string[] {
  return repositoryTerms.filter((term) => !FILE_EXTENSIONS.has(term)).slice(0, 6);
}

export function refinedTask(task: string, term: string): string {
  return `${task} ${term}`.trim().slice(0, MAX_TASK_LENGTH);
}
