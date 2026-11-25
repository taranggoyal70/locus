# README visual sources

The SVGs are generated from committed data by [`scripts/readme-assets.mjs`](../../scripts/readme-assets.mjs),
which takes its look from the site's own sources: the colour tokens in
[`src/app/globals.css`](../../src/app/globals.css), the mark in [`public/locus-mark.svg`](../../public/locus-mark.svg)
and the Newsreader display face in [`src/assets/fonts`](../../src/assets/fonts), under the SIL Open Font License
([`OFL.txt`](../../src/assets/fonts/OFL.txt)). The JPEGs are unedited captures of a production build.

| Asset | Evidence | Scope |
| :--- | :--- | :--- |
| `hero-{dark,light}.svg`, `hero-mobile-{dark,light}.svg` | [`hero-run.json`](hero-run.json), recorded from case `pmndrs/jotai@bc273fd` of the [held-out benchmark](../../benchmarks/heldout/README.md) | One real run, animated. Each mark is one of the 130 source files in the parent snapshot, laid out as the landing page's Fig. 1 lays out a repository: a column for each of the four largest top-level folders and one, `other`, for the rest, each in path order. The lit marks are exactly the files `locate` returned. The case was chosen for sitting at the median reduction (72%), not for looking best. |
| `review-{dark,light}.svg`, `review-mobile-{dark,light}.svg` | [`ProposalReview`](../../src/components/ProposalReview.tsx), [`ProposalPatch`](../../src/components/ProposalPatch.tsx), [`run-review`](../../src/lib/agent/run-review.ts), and [`proposal-patch`](../../src/lib/agent/proposal-patch.ts) | A workflow illustration, not a recorded Run or a screenshot. The two goal labels are illustrative. There is no invented task, check result, model output or performance number. The animation explains a frozen proposal, an explicit human decision and a portable patch. Download is also available before deciding; a rejected proposal has none. |
| `heldout-{dark,light}.svg`, `heldout-mobile-{dark,light}.svg` | [`benchmarks/heldout/results.json`](../../benchmarks/heldout/results.json) | Localized-case recall against a random Slice of the same size, with the task as written and with the scope word removed. |
| `landing.jpg`, `guard-demo.jpg`, `evidence.jpg`, `api-docs.jpg` | `pnpm build` and `pnpm start` at revision `61de47c` | Headless Chromium at 1440 px wide in the light theme on 2026-11-22. `guard-demo.jpg` shows the demo panel at its last step and `api-docs.jpg` the Authentication and `POST /api/v1/locate` sections. The demo is an illustrative story about a fictional billing system. |

## Regenerate

```bash
pnpm readme:assets             # rewrite the SVGs from hero-run.json and results.json
pnpm readme:assets --check     # fail if any committed SVG differs; CI runs this
node scripts/readme-assets.mjs --capture   # re-record hero-run.json (clones jotai)
```

The generator has no dependencies and makes no network calls unless `--capture` is passed. `--capture` refuses
to write if the re-run disagrees with the committed benchmark result.

## Animation

The animations use CSS keyframes inside the SVG. GitHub serves SVG as an image, which runs CSS animation but no script
and loads nothing from outside the file, so the display face travels inside each SVG as a data URI, about 56 KB of
each file; a renderer that ignores it falls back to the system serif. The hero plays once, over 6.4 seconds, and rests on
its final frame, as Fig. 1 does on the site. Every element's resting style is that frame, and
`prefers-reduced-motion` stops the animation, so a reader who has asked for less motion, or a renderer that does
not animate, sees the finished Slice. The review illustration plays once over 8.8 seconds and rests on the complete
three-stage flow. Its checkmarks illustrate the user's decision, not automated acceptance. It shares the same
reduced-motion and static-renderer behavior. Both stories have separate light, dark and mobile layouts.

To inspect a frame, open the SVG in a browser and run
`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 4000; })` with a time from 0 to 6400 ms for
the localization hero, or 0 to 8800 ms for the review illustration.

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
