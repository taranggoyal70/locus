# Depth: Locus, PigeonBox and Continuity

Read from the source the live sites serve (HTML, CSS and JavaScript), on November 20, 2026, not from screenshots.
The counts come from a crawl of each site in Chromium at 1440 by 900. This records how the two references
get their depth and what Locus took from them; for their visual language see
[locus-design-brief.md](./locus-design-brief.md).

## How PigeonBox gets its depth

- **The hero is the product.** A source-built copy of the extension runs in a sandboxed iframe
  (`/assets/gmail-demo/index.html`) against fictional mail. A 21-second script drives it through seven targets,
  with a camera that zooms and pans between keyframes (smootherstep easing) and eight stage labels grouped into
  four chapters. The page (`gmail-demo.js`) controls it over `postMessage`: Pause (`aria-pressed`), Expand into a
  modal `<dialog>` that leaves a placeholder so the page keeps its height, a pause whenever the hero is offscreen
  or the tab is hidden, and a paused start under reduced motion.
- **A site-wide interaction layer** (`site.js`): a ⌘K palette with Go to, Actions (install, copy the install
  command) and "Ask Pigeon" answers shown in place; single-key navigation with a switch to turn it off; a
  terminal easter egg; toasts that carry the mascot's state; reveals that never hide what was on screen at load.
- **Printed art** (`halftone.js`, 45 KB): canvas scenes drawn at one pixel per dot, loaded lazily, animated only
  while visible, still under reduced motion, with a pointer "flashlight".

## How Continuity gets its depth

- **A quantified problem.** Three failures, each with a meter that moves between two measured values and a
  source line under them.
- **A mechanism that plays** (`mechanism.js`). The email types itself out, phrases light up, and SVG connectors,
  measured from the live layout, carry each fact to the state row it changes. It has a Replay control.
- **A replay of a recorded run** (`relay.js`). A pinned scene, one beat per screen of scroll. Every value comes
  from recorded engine output (`snapshot.json`). Stepping forward plays a beat; any other jump renders that
  beat's end state, so scrubbing never queues animations.
- **Results you can inspect** (`charts.js`, `#proof`). A stat row; four benchmarks drawn as bar groups, each
  with a spec table that opens on hover or tap (`aria-live`); four line charts that draw on scroll and read both
  series under the pointer. Each chart names the result file its numbers come from.
- **A live console** (`live.js`, 73 KB). A keyboard-driven presenter with three data sources (a staged run over
  server-sent events, a long-polled engine, a recorded replay), spotlight cues, and the inbox beside the state
  compiled from it.

## Where Locus stood

- **Fig. 1 already runs the product.** The real localizer runs in the visitor's tab on a bundled copy of
  shadcn-ui/taxonomy. Any task works, which a scripted fixture cannot offer. It plays two tasks by itself, then
  hands over the moment it is touched.
- **Fig. 2 played once.** From a recorded run, with import lines measured from the layout, but with no way to
  watch it again.
- **Evidence was three numbers.** The 15 cases behind them lived only in `benchmarks/`.
- **The header had keycap navigation and a scroll thread,** but no search or command layer.

## What this pass adds

| Gap | Reference | Locus now |
|---|---|---|
| Results you can inspect case by case | Continuity's benchmark spec tables | Fig. 3, the case board: all 15 fixes, one mark per source file on one scale, details on hover, focus or tap, each case linked to its fix and snapshot commits. Read from `benchmarks/results.json`, so the page cannot drift from the data. The evidence numbers above it now come from the same file. |
| A figure you can play again | Continuity's mechanism Replay | Replay on Fig. 2. It cancels any beats still pending, so a replay mid-play starts clean. Hidden under reduced motion, where the figure never animates. |
| A site-wide command layer | PigeonBox's ⌘K palette | ⌘K (Ctrl+K) or the header's Search: pages, doc sections, short answers shown in place, and the theme. A native modal dialog. Every answer restates copy the site already publishes. |

## Left out on purpose

- **Canvas art and easter eggs.** They are decoration, and they cost. On the crawl, Continuity's landing ran
  714 animation frames in three idle seconds, and PigeonBox's Local and Pricing pages 361 each. Locus ran none.
  Its file marks already carry the identity.
- **A pinned, scroll-driven replay.** Locus's story is one task becoming one Slice, and Fig. 1 already lets the
  reader drive it.
- **A walkthrough of an Agent Run.** It needs a real recorded Run to stay honest. It is a follow-up, not
  something to stage.
