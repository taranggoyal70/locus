# README visual sources

All primary README visuals are animated SVGs generated from committed data and source contracts by
[`scripts/readme-assets.mjs`](../../scripts/readme-assets.mjs),
which takes its look from the site's own sources: the colour tokens in
[`src/app/globals.css`](../../src/app/globals.css), the mark in [`public/locus-mark.svg`](../../public/locus-mark.svg)
and the Newsreader display face in [`src/assets/fonts`](../../src/assets/fonts), under the SIL Open Font License
([`OFL.txt`](../../src/assets/fonts/OFL.txt)). The older JPEG captures are archived assets, no longer embedded
in the primary README.

| Asset | Evidence | Scope |
| :--- | :--- | :--- |
| `hero-{dark,light}.svg`, `hero-mobile-{dark,light}.svg` | [`hero-run.json`](hero-run.json), recorded from case `pmndrs/jotai@bc273fd` of the [held-out benchmark](../../benchmarks/heldout/README.md) | One real run, animated. Each mark is one of the 130 source files in the parent snapshot, laid out as the landing page's Fig. 1 lays out a repository: a column for each of the four largest top-level folders and one, `other`, for the rest, each in path order. The lit marks are exactly the files `locate` returned. The case was chosen for sitting at the median reduction (72%), not for looking best. |
| `review-{dark,light}.svg`, `review-mobile-{dark,light}.svg` | [`ProposalReview`](../../src/components/ProposalReview.tsx), [`ProposalPatch`](../../src/components/ProposalPatch.tsx), [`run-review`](../../src/lib/agent/run-review.ts), and [`proposal-patch`](../../src/lib/agent/proposal-patch.ts) | A workflow illustration, not a recorded Run or a screenshot. The two goal labels are illustrative. There is no invented task, check result, model output or performance number. The animation explains a frozen proposal, an explicit human decision and a portable patch. Download is also available before deciding; a rejected proposal has none. |
| `heldout-{dark,light}.svg`, `heldout-mobile-{dark,light}.svg` | [`benchmarks/heldout/results.json`](../../benchmarks/heldout/results.json) | Localized-case recall against a random Slice of the same size, with the task as written and with the scope word removed. |
| `feature-localize-{dark,light}.svg`, mobile variants | [`hero-run.json`](hero-run.json) | Typed task and staged file-list reveal using the recorded jotai Slice. Every displayed file and count comes from that record. |
| `feature-inspect-cycle-{dark,light}.svg`, mobile variants | [`LocusFigure.tsx`](../../src/components/LocusFigure.tsx), [`locus-layout.ts`](../../src/lib/locus-layout.ts), [`landing-orbits.json`](../../src/lib/landing-orbits.json), bundled [taxonomy Repo](../../public/repos/taxonomy.json) | Cycles all four tasks in 24 seconds: editor 14 files, webhook 3, billing 23, Widen all 125. The same file marks morph between the website’s ring layouts and golden-angle Widen disc. Task indicators, token counts, actual Anchor hovers and import edges stay synchronized. The generator validates file identities and counts against the bundled localizer for every task. Widen has no invented Anchors or edges. |
| `feature-cases-{dark,light}.svg`, mobile variants | [`CaseBoard.tsx`](../../src/components/CaseBoard.tsx), [`benchmarks/heldout/results.json`](../../benchmarks/heldout/results.json) | Replays selecting the jotai tab and the real bc273fd fix row, with its admitted count, reduction and maintainer-changed file. The unfinished paired agent study remains documented in the technical results section; its zero counter is no longer the feature illustration. |
| `feature-handoff-{dark,light}.svg`, mobile variants | [`ProductDemo.tsx`](../../src/components/ProductDemo.tsx), [`demo-script.ts`](../../src/lib/demo-script.ts), bundled [taxonomy Repo](../../public/repos/taxonomy.json) | Replays format selection, copy feedback and the abbreviated pasted context in an agent view. The 14 files and 6,448 estimated tokens come from the same bundled localizer run as the website. Cursor movements are presentation; no clipboard or agent request is performed by the SVG. |
| `architecture-{dark,light}.svg`, mobile variants | [`localizer.ts`](../../src/lib/localizer.ts), [hosted Workflow](../../src/workflows/agent-run.ts), [patch endpoint](../../src/app/api/agent/runs/%5Bid%5D/patch/route.ts), [`guard-runner.mjs`](../../bin/guard-runner.mjs) | Animated architecture map. The hosted review/patch path and local Guard/receipt path remain separate. |
| `landing.jpg`, `guard-demo.jpg`, `evidence.jpg`, `api-docs.jpg` | `pnpm build` and `pnpm start` at revision `61de47c` | Headless Chromium at 1440 px wide in the light theme on 2026-11-22. `guard-demo.jpg` shows the demo panel at its last step and `api-docs.jpg` the Authentication and `POST /api/v1/locate` sections. The demo is an illustrative story about a fictional billing system. |

## Regenerate

```bash
pnpm readme:assets             # regenerate all 32 SVGs from the committed inputs
pnpm readme:assets --check     # fail if any committed SVG differs; CI runs this
node scripts/readme-assets.mjs --capture   # re-record hero-run.json (clones jotai)
```

The generator uses only Node built-ins and the local `bin/core.mjs` engine, and makes no network calls unless `--capture` is passed. The interaction replays are rendered by [`readme-interactions.mjs`](../../scripts/readme-interactions.mjs). `--capture` refuses
to write if the re-run disagrees with the committed benchmark result.

## Animation

The animations use CSS keyframes inside the SVG. GitHub serves SVG as an image, which runs CSS animation but no script
and loads nothing from outside the file, so the display face travels inside each SVG as a data URI, about 56 KB of
each file; a renderer that ignores it falls back to the system serif.

All eight visual families have separate desktop/mobile and light/dark layouts. The four-task map repeats on a 24-second loop, holding each task for six seconds. The other families repeat on a 12-second
clock with a readable result hold. Repetition keeps a feature discoverable when a reader scrolls to it after
the page has loaded; these are replays, not new operations or new results. The four static feature screenshots
and static architecture diagram have been replaced in the primary README. The feature replays now follow the
actual website’s file inspection, case selection and context handoff rather than generic protocol diagrams. The benchmark bars reveal their
recorded values on the same cycle without inventing intermediate measurements.

Every element's resting style is its completed state. `prefers-reduced-motion` disables every animation,
showing the finished result without repeated reveals. The review checkmarks illustrate the user's decision,
not automated acceptance. GitHub image embeds cannot provide the app's pause/seek controls or offscreen
IntersectionObserver behavior, so these lightweight SVGs use CSS only, readable holds and a reduced-motion
alternative; they never run JavaScript or make provider requests.

To inspect a frame, open the SVG in a browser and run
`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4000; })` with a time from 0 to 12000 ms.

## Reproduce the captures

Run `pnpm build` and `pnpm start` with the Clerk keys in `.env.local` (these pages need nothing else), then
capture each page at device scale 1 with the light colour scheme:

| Image | Page | Window | Crop |
| :--- | :--- | :--- | :--- |
| `landing.jpg` | `/` | 1440 x 900 | none |
| `evidence.jpg` | `/evidence/release-1` | 1440 x 900 | none |
| `api-docs.jpg` | `/docs` | 1440 x 1500 | 590 px from y = 600 |
| `guard-demo.jpg` | `/demo`, after choosing step 4, Signed proof ready | 1440 x 1800 | 822 px from y = 682 |

Headless Chrome takes the pages that need no click:

```bash
chrome --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 \
  --screenshot=landing.png http://localhost:3000/
```

The demo needs the click, so it was taken with Playwright's Chromium. Convert each capture to JPEG at quality 82
without chroma subsampling, which keeps the demo's small coloured text sharp.
