# README visual sources

The SVGs are generated from committed data by [`scripts/readme-assets.mjs`](../../scripts/readme-assets.mjs).
The JPEGs are unedited captures of the live deployment. Colours follow the product's own palette in
[`src/app/globals.css`](../../src/app/globals.css) and [`public/locus-mark.svg`](../../public/locus-mark.svg).

| Asset | Evidence | Scope |
| :--- | :--- | :--- |
| `hero-{dark,light}.svg`, `hero-mobile-{dark,light}.svg` | [`hero-run.json`](hero-run.json), recorded from case `pmndrs/jotai@bc273fd` of the [held-out benchmark](../../benchmarks/heldout/README.md) | One real run, animated. Each cell is one of the 130 source files in the parent snapshot, in path order; the lit cells are exactly the files `locate` returned. The case was chosen for sitting at the median reduction (72%), not for looking best. |
| `heldout-{dark,light}.svg` | [`benchmarks/heldout/results.json`](../../benchmarks/heldout/results.json) | Localized-case recall against a random Slice of the same size, with the task as written and with the scope word removed. |
| `landing.jpg`, `guard-demo.jpg`, `evidence.jpg`, `api-docs.jpg` | `https://locus-five-iota.vercel.app` at revision `0749e6d` | Headless Chrome at 1440 px wide on 2026-11-19. `guard-demo.jpg` is cropped to the demo panel and `api-docs.jpg` to the top of the page. The demo is an illustrative story about a fictional billing system. |

## Regenerate

```bash
pnpm readme:assets             # rewrite the SVGs from hero-run.json and results.json
pnpm readme:assets --check     # fail if any committed SVG differs; CI runs this
node scripts/readme-assets.mjs --capture   # re-record hero-run.json (clones jotai)
```

The generator has no dependencies and makes no network calls unless `--capture` is passed. `--capture` refuses
to write if the re-run disagrees with the committed benchmark result.

## Animation

The hero is CSS keyframes inside the SVG: GitHub serves SVG as an image, which runs CSS animation but no script or
web font. Every element's resting style is its final frame, and `prefers-reduced-motion` stops the animation, so a
reader who has asked for less motion, or a renderer that does not animate, sees the finished Slice. Each loop is
12 seconds. To inspect a frame, open the SVG in a browser and run
`document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 9000; })`.

## Reproduce the captures

```bash
chrome --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 \
  --screenshot=landing.png https://locus-five-iota.vercel.app/
```

Use `--window-size=1440,1800` for `/demo` and crop 780 px from y = 610; crop `/docs` to its first 590 px. Convert
to JPEG at quality 82.
