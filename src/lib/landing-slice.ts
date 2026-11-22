import type { LocateResult } from "@/lib/types";

/**
 * The Slice the home page demo plays: a real localization, recorded.
 *
 * Locus ran on the copy of shadcn-ui/taxonomy bundled in
 * public/repos/taxonomy.json with the task below. Recorded rather than run per
 * request so the page stays static and the figure never changes under a reader.
 * landing-slice.test.ts re-runs the localizer and fails if this record drifts
 * from what the engine now returns, so the page cannot keep showing a result
 * Locus no longer produces.
 */
export const RECORDED_SLICE = {
  repo: "shadcn-ui/taxonomy",
  repoUrl: "https://github.com/shadcn-ui/taxonomy",
  task: "the post editor loses changes on save",
  files: [
    "app/(auth)/layout.tsx",
    "app/(auth)/login/page.tsx",
    "app/(auth)/register/page.tsx",
    "app/(dashboard)/dashboard/billing/loading.tsx",
    "app/(dashboard)/dashboard/billing/page.tsx",
    "app/(dashboard)/dashboard/layout.tsx",
    "app/(dashboard)/dashboard/loading.tsx",
    "app/(dashboard)/dashboard/page.tsx",
    "app/(dashboard)/dashboard/settings/loading.tsx",
    "app/(dashboard)/dashboard/settings/page.tsx",
    "app/(docs)/docs/[[...slug]]/page.tsx",
    "app/(docs)/docs/layout.tsx",
    "app/(docs)/guides/[...slug]/page.tsx",
    "app/(docs)/guides/layout.tsx",
    "app/(docs)/guides/page.tsx",
    "app/(docs)/layout.tsx",
    "app/(editor)/editor/[postId]/loading.tsx",
    "app/(editor)/editor/[postId]/not-found.tsx",
    "app/(editor)/editor/[postId]/page.tsx",
    "app/(editor)/editor/layout.tsx",
    "app/(marketing)/[...slug]/page.tsx",
    "app/(marketing)/blog/[...slug]/page.tsx",
    "app/(marketing)/blog/page.tsx",
    "app/(marketing)/layout.tsx",
    "app/(marketing)/page.tsx",
    "app/(marketing)/pricing/page.tsx",
    "app/api/auth/[...nextauth]/_route.ts",
    "app/api/og/route.tsx",
    "app/api/posts/[postId]/route.ts",
    "app/api/posts/route.ts",
    "app/api/users/[userId]/route.ts",
    "app/api/users/stripe/route.ts",
    "app/api/webhooks/stripe/route.ts",
    "app/layout.tsx",
    "app/robots.ts",
    "components/analytics.tsx",
    "components/billing-form.tsx",
    "components/callout.tsx",
    "components/card-skeleton.tsx",
    "components/editor.tsx",
    "components/empty-placeholder.tsx",
    "components/header.tsx",
    "components/icons.tsx",
    "components/main-nav.tsx",
    "components/mdx-card.tsx",
    "components/mdx-components.tsx",
    "components/mobile-nav.tsx",
    "components/mode-toggle.tsx",
    "components/nav.tsx",
    "components/page-header.tsx",
    "components/pager.tsx",
    "components/post-create-button.tsx",
    "components/post-item.tsx",
    "components/post-operations.tsx",
    "components/search.tsx",
    "components/shell.tsx",
    "components/sidebar-nav.tsx",
    "components/site-footer.tsx",
    "components/tailwind-indicator.tsx",
    "components/theme-provider.tsx",
    "components/toc.tsx",
    "components/ui/accordion.tsx",
    "components/ui/alert-dialog.tsx",
    "components/ui/alert.tsx",
    "components/ui/aspect-ratio.tsx",
    "components/ui/avatar.tsx",
    "components/ui/badge.tsx",
    "components/ui/button.tsx",
    "components/ui/calendar.tsx",
    "components/ui/card.tsx",
    "components/ui/checkbox.tsx",
    "components/ui/collapsible.tsx",
    "components/ui/command.tsx",
    "components/ui/context-menu.tsx",
    "components/ui/dialog.tsx",
    "components/ui/dropdown-menu.tsx",
    "components/ui/hover-card.tsx",
    "components/ui/input.tsx",
    "components/ui/label.tsx",
    "components/ui/menubar.tsx",
    "components/ui/navigation-menu.tsx",
    "components/ui/popover.tsx",
    "components/ui/progress.tsx",
    "components/ui/radio-group.tsx",
    "components/ui/scroll-area.tsx",
    "components/ui/select.tsx",
    "components/ui/separator.tsx",
    "components/ui/sheet.tsx",
    "components/ui/skeleton.tsx",
    "components/ui/slider.tsx",
    "components/ui/switch.tsx",
    "components/ui/tabs.tsx",
    "components/ui/textarea.tsx",
    "components/ui/toast.tsx",
    "components/ui/toaster.tsx",
    "components/ui/toggle.tsx",
    "components/ui/tooltip.tsx",
    "components/ui/use-toast.ts",
    "components/user-account-nav.tsx",
    "components/user-auth-form.tsx",
    "components/user-avatar.tsx",
    "components/user-name-form.tsx",
    "config/dashboard.ts",
    "config/docs.ts",
    "config/marketing.ts",
    "config/site.ts",
    "config/subscriptions.ts",
    "hooks/use-lock-body.ts",
    "hooks/use-mounted.ts",
    "lib/auth.ts",
    "lib/db.ts",
    "lib/exceptions.ts",
    "lib/session.ts",
    "lib/stripe.ts",
    "lib/subscription.ts",
    "lib/toc.ts",
    "lib/utils.ts",
    "lib/validations/auth.ts",
    "lib/validations/og.ts",
    "lib/validations/post.ts",
    "lib/validations/user.ts",
    "middleware.ts",
    "pages/api/auth/[...nextauth].ts",
    "types/index.d.ts",
    "types/next-auth.d.ts",
  ],
  slice: [
    { path: "app/(editor)/editor/[postId]/not-found.tsx", dist: 0, tokens: 164, recent: false },
    { path: "app/(editor)/editor/[postId]/page.tsx", dist: 0, tokens: 238, recent: false },
    { path: "components/editor.tsx", dist: 0, tokens: 1230, recent: false },
    { path: "lib/auth.ts", dist: 1, tokens: 696, recent: true },
    { path: "lib/utils.ts", dist: 1, tokens: 123, recent: true },
    { path: "components/empty-placeholder.tsx", dist: 1, tokens: 466, recent: false },
    { path: "components/icons.tsx", dist: 1, tokens: 622, recent: false },
    { path: "components/ui/button.tsx", dist: 1, tokens: 412, recent: false },
    { path: "components/ui/use-toast.ts", dist: 1, tokens: 984, recent: false },
    { path: "lib/db.ts", dist: 1, tokens: 96, recent: false },
    { path: "lib/session.ts", dist: 1, tokens: 54, recent: false },
    { path: "lib/validations/post.ts", dist: 1, tokens: 52, recent: false },
    { path: "components/ui/toast.tsx", dist: 2, tokens: 1208, recent: false },
    { path: "config/site.ts", dist: 2, tokens: 103, recent: false },
  ],
  anchors: ["app/(editor)/editor/[postId]/page.tsx", "app/(editor)/editor/[postId]/not-found.tsx", "components/editor.tsx"],
  /** Import edges between Slice files, importer first. */
  edges: [
    ["app/(editor)/editor/[postId]/not-found.tsx", "components/ui/button.tsx"],
    ["app/(editor)/editor/[postId]/not-found.tsx", "components/empty-placeholder.tsx"],
    ["app/(editor)/editor/[postId]/page.tsx", "lib/auth.ts"],
    ["app/(editor)/editor/[postId]/page.tsx", "lib/db.ts"],
    ["app/(editor)/editor/[postId]/page.tsx", "lib/session.ts"],
    ["app/(editor)/editor/[postId]/page.tsx", "components/editor.tsx"],
    ["components/editor.tsx", "lib/utils.ts"],
    ["components/editor.tsx", "lib/validations/post.ts"],
    ["components/editor.tsx", "components/ui/button.tsx"],
    ["components/editor.tsx", "components/ui/use-toast.ts"],
    ["components/editor.tsx", "components/icons.tsx"],
    ["components/empty-placeholder.tsx", "lib/utils.ts"],
    ["components/empty-placeholder.tsx", "components/icons.tsx"],
    ["components/ui/button.tsx", "lib/utils.ts"],
    ["components/ui/toast.tsx", "lib/utils.ts"],
    ["components/ui/use-toast.ts", "components/ui/toast.tsx"],
    ["lib/auth.ts", "config/site.ts"],
    ["lib/auth.ts", "lib/db.ts"],
    ["lib/session.ts", "lib/auth.ts"],
  ],
  sliceTokens: 6448,
  totalTokens: 56404,
  widened: false,
  reason: "matched app/(editor)/editor/[postId]/page.tsx, app/(editor)/editor/[postId]/not-found.tsx, components/editor.tsx",
  savedPct: 89,
  edgeDensity: 1.984,
  sparse: false,
} as const;

/**
 * The record in the shape the product's own panels take, so the page can show
 * the real FilePanel from the first paint, before the engine has loaded.
 */
export const RECORDED_RESULT: LocateResult = {
  task: RECORDED_SLICE.task,
  widened: RECORDED_SLICE.widened,
  reason: RECORDED_SLICE.reason,
  anchors: [...RECORDED_SLICE.anchors],
  anchorPaths: [...RECORDED_SLICE.anchors],
  slice: RECORDED_SLICE.slice.map((file) => ({ ...file, rel: file.path })),
  excluded: RECORDED_SLICE.files.filter((file) => !RECORDED_SLICE.slice.some(({ path }) => path === file)),
  excludedPaths: RECORDED_SLICE.files.filter((file) => !RECORDED_SLICE.slice.some(({ path }) => path === file)),
  sliceTokens: RECORDED_SLICE.sliceTokens,
  totalTokens: RECORDED_SLICE.totalTokens,
  savedPct: RECORDED_SLICE.savedPct,
  refinement: null,
  edgeDensity: RECORDED_SLICE.edgeDensity,
  sparse: RECORDED_SLICE.sparse,
};

export type RepoMapColumn = {
  label: string;
  /** Every file in the column, sorted, so a mark's place is stable. */
  files: string[];
};

const COLUMN_PREFIXES = ["app/", "components/", "lib/"] as const;

/**
 * The Repo laid out the way the demo's Repo map draws it: one column per large
 * top-level folder, and every smaller folder and loose file gathered into
 * "other".
 */
export function repoMapColumns(files: readonly string[]): RepoMapColumn[] {
  const columns = new Map<string, string[]>();
  for (const file of files) {
    const prefix = COLUMN_PREFIXES.find((candidate) => file.startsWith(candidate));
    const label = prefix ? prefix.slice(0, -1) : "other";
    columns.set(label, [...(columns.get(label) ?? []), file]);
  }
  return [...COLUMN_PREFIXES.map((prefix) => prefix.slice(0, -1)), "other"]
    .filter((label) => columns.has(label))
    .map((label) => ({ label, files: columns.get(label)! }));
}
