# Locus product audit — 2026-07-15

## Outcome

The core product concept is strong: the context trace is explainable, weak tasks widen conservatively, and the context pack has a direct copy action. The biggest problems were at the product boundary rather than in the localizer itself: signed-out access was too open, mobile authentication was broken, workspace errors could leave stale results on screen, and the signed-in page repeated too much marketing content.

## Journey health

| Step | Health after fixes | Evidence and action |
| --- | --- | --- |
| Sign in | Healthy | Mobile form is now fully visible with no horizontal overflow; product branding replaces the Clerk project name. |
| Sign up | Healthy | Same responsive shell fix; signed-out users can create an account but cannot enter the product. |
| Reach workspace | Healthy | `/`, `/workspace`, `/demo`, repository data, and GitHub analysis require authentication. |
| Choose repository | Improved | Clearly says public GitHub repositories only, explains in-memory processing, and labels the bundled option as a sample. |
| Describe task | Healthy | Plain-language task input, example tasks, and live result updates are clear. |
| Understand selection | Healthy | The three-stage trace clearly separates task matches, dependencies, and nearby integration files. |
| Weak evidence | Healthy | Locus visibly widens to the whole repository instead of claiming false precision. |
| Failed repository | Healthy | Old results and share actions are cleared; one useful live-region error remains. |
| Inspect/copy output | Healthy | Ranked files, file preview, token estimate, and context-pack copy form a coherent completion path. |

## Fixed in this pass

1. Removed public-product bypasses and protected repository/API access.
2. Rebuilt the authentication shell for real mobile widths and moved the form above secondary process cards.
3. Changed Clerk-facing titles to “Locus” instead of the internal `locus-auth` project name.
4. Cleared stale repository state immediately when a new load begins or fails.
5. Limited share links to the repository that actually loaded, not whatever text is currently in the input.
6. Added polite status/error announcements and resilient handling for non-JSON upstream failures.
7. Compressed the signed-in hero and removed benchmark/CLI marketing sections from the workspace.
8. Clarified public-repository and data-retention constraints at the decision point.
9. Updated setup documentation, Clerk environment variables, route access descriptions, and the 120-file hosted limit.

## Product priorities still worth doing

### P1 — validate conversion and trust

- Run an authenticated end-to-end test against a preview deployment: create account, verify email, load a real repository, copy a pack, sign out, and confirm shared URLs return to login.
- Add privacy, terms, and a short security/data-handling page before inviting broader external usage.
- Instrument a minimal funnel: sign-up started/completed, repository load succeeded/failed, task produced focused/widened result, and context copied. Do not send repository names, tasks, or file paths.
- Add first-run guidance around what makes a useful task and why results may widen.

### P2 — improve retention

- Let users save recent repository identifiers locally or opt in to account-level history; never save source content by default.
- Add a clear “analyze another repository” reset and a recent successful repository shortcut.
- Expand supported file types only after measuring demand; the current TypeScript/Next.js constraint should stay explicit.
- Add keyboard-only and screen-reader regression coverage for auth, file selection, live result updates, and copy confirmation.

## Evidence

- Before: mobile sign-in was clipped beyond the viewport (`04-sign-in-mobile.png`).
- Before: a failed repository load retained the prior trace and enabled a misleading share action (`09-workspace-error.png`).
- After: repaired mobile sign-in (`11-after-auth-mobile.jpg`).
- After: compact signed-in workspace (`12-after-workspace-desktop.jpg`, `13-after-workspace-mobile.jpg`).
- After: single, actionable repository error with stale content removed (`14-after-error.jpg`).

## Evidence limits

The live production demo and signed-out auth screens were inspected on desktop and 390px mobile widths. The repaired implementation was inspected locally at the same widths. A real email verification and authenticated production session were not completed, and this was not a formal WCAG conformance audit.
