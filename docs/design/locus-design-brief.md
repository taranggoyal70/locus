# Locus design brief: the evidence datasheet

The reference for every Locus surface: palette, type, the Slice aperture, motion
and copy rules. Write the brief first, then build against it. Change the brief
when a decision changes, not the code alone.

## Purpose

Locus sells one idea: an agent should see the task, not the Repo, and you should
be able to check what it saw. The page has to make that visible in a few seconds
and then hold up under a skeptical engineer's second look.

The look is a technical datasheet. Daylight paper, navy ink, hairline rules,
mono for data, and colour that only ever means a Slice state. The signature is
the **aperture**: a Repo drawn as a field of files that closes onto the Slice.
It is the only illustration Locus needs.

## Where the current UI falls short (audit, November 3, 2026)

Measured in `src/` and on https://locus-five-iota.vercel.app at 1024px.

- **Two visual systems.** The landing page is a light mineral canvas; `/demo` is
  a dark navy and mint page with its own palette. They read as two products.
- **Too many sizes and radii.** 95 uses of 8 to 10px text (`text-[8px]`,
  `text-[9px]`, `text-[10px]`), mostly mono uppercase. Thirteen radius values,
  including `rounded-[18px]` through `rounded-[30px]`.
- **Hard-coded colour.** 151 hex literals in components (`#8ef0c0` 36
  times, `#14233b` 25 times) instead of tokens.
- **Inverted token names.** `--ink` is the page background and `--paper` is the
  dark text colour. Anyone reading the CSS gets it backwards.
- **Decoration standing in for evidence.** A 32px grid on the whole body, radial
  mint glows, a blurred halo behind the hero card, and two animations that loop
  forever (`context-drift`, `migration-orbit`) whether or not work is happening.
- **A crowded hero.** A pill, a mono eyebrow, a two-line display headline, two
  paragraphs, three equal-weight buttons and two more caption lines. Nothing is
  clearly the next step.
- **Eyebrow habit.** Mono uppercase labels with wide tracking (`0.12em` to
  `0.18em`) sit above nearly every block, so none of them signal anything.
- **Em dashes in copy** in 15 component files.

What already works and stays: the navy and teal identity, Geist and Geist Mono,
the evidence strip that states its own limits, the Locate / Implement / Check /
Review sequence, and the aperture idea in `ContextLens` and `MigrationDemo`.

## Reference study (November 3, 2026)

Principles to adapt, not layouts or assets to copy.

- [Continuity](https://continuity-demo-tau.vercel.app/) by Aiden Guan, and its
  [source](https://github.com/aiden-guan/continuity/tree/main/site): the closest
  match in spirit. A whole system in one short token block: two surfaces, two
  line weights, four ink weights, one signal colour plus a "check passed" green,
  one ease, two radii (6px and 10px). Adopt the datasheet discipline and the
  rule that colour means "something changed." Avoid its warm paper and orange,
  which are its identity, not ours.
- [PigeonBox design docs](https://github.com/aiden-guan/pigeonbox/tree/main/docs/design):
  the process this brief follows. Dated references with adopt and avoid notes, a
  six-role palette table, motion in exact milliseconds, an explicit avoid list,
  and browser verification at real widths.
- [Amp](https://ampcode.com/): one warm accent used only on the primary action,
  and real task strings floating in the hero instead of abstract shapes. Adopt
  real task text as imagery. Avoid the dark atmospheric gradient.
- [PlanetScale](https://planetscale.com/): mono used with confidence, dense
  honest prose, bordered buttons. Adopt the willingness to be plain and dense.
  Avoid all-mono body text, which is tiring past one screen.
- [Linear](https://linear.app/) and [Graphite](https://graphite.com/): a quiet
  nav with one solid button and nothing competing with it. Adopt the single
  primary action per view. Both are dark-first; Locus stays daylight, which also
  sets it apart from most agent tools.
- [shadcn/ui](https://ui.shadcn.com/) and
  [Emil Kowalski's animation tips](https://emilkowal.ski/ui/7-practical-animation-tips):
  predictable controls, quiet borders, immediate press feedback, short ease-out,
  menus that grow from their trigger. Use the principles. Do not add a component
  library for a visual refresh.

## System

### Palette

Rename the tokens so names match roles, and move every hex literal in
components onto them. Each token is also a Tailwind colour of the same name
(`bg-canvas`, `text-ink-2`, `border-line-2`, `text-included`).

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#F4F3EF` | Page background (neutral paper) |
| `--surface` | `#FBFAF7` | Cards, panels, inputs |
| `--surface-2` | `#EBE9E3` | Wells, table headers, skeletons |
| `--line` | `rgba(20, 35, 59, 0.10)` | Default hairline |
| `--line-2` | `rgba(20, 35, 59, 0.18)` | Emphasised hairline, input borders |
| `--ink` | `#14233B` | Headlines, body, primary button |
| `--ink-2` | `#3E4F63` | Supporting text |
| `--muted` | `#5C6A78` | Captions, metadata |
| `--included` | `#087864` | Included files, passing Checks, focus ring |
| `--widened` | `#925C0E` | Widen, attention needed |
| `--excluded` | `#D3D0C8` | Excluded files (always paired with a label) |
| `--failed` | `#B03A2E` | Failed Checks and errors only |

The dark band (the demo, the closing call to action) uses the same roles on
navy: `--canvas` `#0F1B2E`, `--surface` `#16263D`, `--surface-2` `#1D3049`,
`--ink` `#EEF2F0`, `--ink-2` `#B4C1CE`, `--muted` `#91A4B6`, `--included`
`#3FBF9F`. Same tokens, swapped values, under a `data-band="dark"` attribute.
No separate demo palette.

`src/app/design-tokens.test.ts` holds every text and state colour above 4.5:1
on its canvas and surface, in both the light page and the dark band.

**Colour rule:** teal, amber and grey describe a file's or Check's state. They
are never decoration. If a teal element does not mean Included or passing,
make it ink.

### Type

- **Geist** for everything readable, **Geist Mono** for data only: file paths,
  counts, hashes, statuses, commands. Mono is not a decoration for labels.
- Retire Bricolage Grotesque. One sans family keeps the datasheet calm.
- Display weight 600, tracking no tighter than `-0.04em`, line-height 1.0.
  Hero `clamp(44px, 7vw, 96px)`; section heads `clamp(32px, 4.4vw, 56px)`.
- Text scale: 12, 13, 15, 17, 20. Body 15 or 17. **Nothing below 11px**, and
  mono labels are 11px minimum.
- Uppercase eyebrows: at most one per section, `0.08em` tracking, and only when
  it names something (a step number, a state). Never stack two.
- `tabular-nums` on every number that can change.

### Shape and surface

- Three radii: `6px` (`rounded-chip`: chips, inputs, file rows), `10px`
  (`rounded-card`: buttons, cards, panels), `999px` (`rounded-full`: status
  dots only). The shadow below is `shadow-panel`.
- Borders do the work. One shadow token for raised panels:
  `0 1px 0 rgba(20,35,59,.04), 0 12px 32px -18px rgba(20,35,59,.22)`.
- No full-page grid, no radial glows, no blurred halos, no glass. The grid
  belongs inside the aperture figure, where it means "the Repo."

### Layout

- Max width 1200px; gutter `clamp(16px, 4vw, 40px)`; section spacing 96px
  desktop, 64px phone.
- One primary action per view. Secondary actions are text links or a single
  outlined button.
- Product evidence is the hero image, at a size where the file names are
  readable. On phones, show the Slice list, not a shrunken desktop panel.

## The aperture

The single signature element. A Repo is drawn as a field of small square file
marks, one per file, in a column per top-level folder. It starts with every
mark under one neutral cover: the whole Repo, the way an agent sees it without
Locus. Closing lifts the covers: Excluded marks settle to `--excluded`, Slice
marks show `--included`, and Anchors carry a hollow centre. A count changes
from `125` to `14 / 125`.

If a localization Widens, Locus returns the whole Repo, so every mark stays
`--included` and the count says so. Amber `--widened` belongs to Agent Runs,
where a Widen attempt asks to read one more file; the landing never shows it.

- **Data, not decoration.** The landing page renders a recorded localization of
  the copy of shadcn-ui/taxonomy bundled in `public/repos/` (`src/lib/landing-slice.ts`,
  labelled "Recorded run"). `landing-slice.test.ts` re-runs the localizer and
  fails if the record drifts. In the app it renders the user's actual Slice.
- It appears in three places: the landing page's Fig. 1, the loading state
  while localizing, and the header of a Run receipt. Nowhere else.
- `src/components/Aperture.tsx`: HTML and CSS, no new dependency. The app's
  `ContextLens` is a hand-placed illustration and moves onto it in step 4.

## The mechanism (Fig. 2)

The story of how the Slice in Fig. 1 was built, played once when it scrolls
into view, from the same record. The task types itself out; the task words
found in the Anchor paths highlight; the Anchors appear; real import lines draw
out to the files one hop away, then two; the context meter runs down from the
whole Repo's tokens to the Slice's, and the count of files held outside
appears. Every path, line and number is recorded output. Narrow screens stack
the three columns and skip the lines; the sequence still plays.
`src/components/Mechanism.tsx`.

## Print grammar

The page reads as a technical sheet, not a stack of cards.

- **Margin rails:** hairlines down both edges of the content column.
- **Rules:** a full-width hairline between sections, with a small crosshair
  where it crosses each rail.
- **Section labels:** `01  THE SLICE`: a number in ink and a mono label that
  decodes from glyph noise once, the first time it scrolls into view.
- **Section headings:** two short lines, the second in `--muted`
  ("One task." / "14 of 125 files.").
- **Figures:** every figure has a caption, `Fig. 1  What it shows, and where
  its numbers come from.`

`src/components/Datasheet.tsx`.

## Motion

| Token | Value |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` |
| `--dur-press` | `100ms` |
| `--dur-quick` | `160ms` (hover, menus, tooltips) |
| `--dur-panel` | `280ms` (drawers, tabs, row expand) |
| `--dur-story` | `900ms` (aperture close, once) |

- Buttons scale to `0.97` on press. No lift on hover; hover changes colour only.
- Menus and popovers grow from their trigger's corner.
- The aperture closes once when it enters the viewport: 200ms hold, 900ms for
  the covers to lift, then the Slice marks settle (`--dur-panel`). It does not
  loop.
- Loops are allowed only while real work is running (localizing, a Run in
  progress), and stop the moment it finishes. Remove `context-drift`,
  `migration-orbit` and the idle `migration-pulse`.
- Motion pieces (`src/components/Reveal.tsx`): headings rise word by word out
  of a mask; mono labels decode from glyph noise; numbers count up to their
  printed value; a hairline under the header fills with scroll progress. The
  hero headline rises on first paint with CSS alone.
- **The rule that keeps it honest:** the server renders the final state, and an
  element only animates if it was offscreen at load and later scrolls into
  view. Nothing already on screen ever flashes from shown to hidden.
- No scroll hijacking, no parallax, no cursor-following effects.
- Animate `transform` and `opacity`; `clip-path` and `stroke-dashoffset` only to
  type or draw; colour only when a state changes.
- Reduced motion: show the final state immediately. Every state is readable
  without animation.

## Copy

- Use the domain terms exactly as `CONTEXT.md` defines them: Repo, Slice,
  Anchor, Widen, Surface, Check, Run.
- No em dashes. Use a plain dash, a comma, or a new sentence.
- Mark illustrative content as illustrative. Never invent customers, logos,
  quotes or numbers. Every figure carries its own caveat, as the evidence strip
  already does.
- Button labels are verbs: "Localize a Repo", "Watch a recorded Run". No
  "free" tacked onto the label; put pricing reassurance in the caption.

## Avoid

Display serif or italic headings, gradient text, mint glow, glassmorphism,
floating icon confetti, a row of three identical feature cards, numbered
feature lists used as decoration, fake trust logos, testimonial carousels,
endless background animation, more than one accent colour on a screen, and any
mono uppercase text under 11px.

## Rollout order

Each step ships on its own and leaves the site consistent.

1. **Tokens.** Rename and replace the tokens in `src/app/globals.css`; map the
   old names to the new ones so nothing breaks; remove body grid and glows.
   The old `--ink` was the background and the old `--paper` the text, so those
   two cannot alias: every `*-ink` class became `*-canvas` and every
   `*-paper` class became `*-ink`. The rest (`accent`, `line-strong`,
   `muted-light`, `surface-raised`, `recent`) alias to the new roles.
2. **Marketing shell and landing.** `MarketingShell`, `LandingPage`: new hero
   with the aperture, one primary action, eyebrow cleanup, radius cleanup.
3. **Demo.** `MigrationDemo` and `/demo` move onto the shared tokens inside a
   `data-band="dark"` section.
4. **App.** `LocusApp`, `AgentRunPanel`, `FilePanel`, `RunContextLedger`,
   `DependencyGraph`, `AgentRunsList`: replace hex literals and tiny text,
   apply state colours.
5. **Auth, settings, pricing, docs, legal.** Same tokens; no new patterns.
6. **Remove the compatibility token aliases** once nothing reads them.

## Verification

Run for every step, and record the result at the bottom of this file.

- `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Browser at 1440, 1024, 390 and 320px: no horizontal scroll, hero file names
  readable, one obvious primary action, focus rings visible on every control.
- Reduced motion on: aperture shows its final state, nothing loops.
- Contrast: body text and every state colour on its background meet WCAG AA
  (4.5:1). `--excluded` marks are deliberately faint (1.5:1) and so must never
  carry meaning alone: every Excluded file also has an ink label.
- `grep` for hex literals in `src/components` and for `text-[8px]`,
  `text-[9px]`, `text-[10px]`: both should trend to zero.
- Screenshots of each changed surface saved under `docs/design/` beside this
  file, before and after.

## Results

### Step 1: tokens (November 3, 2026)

- `pnpm lint` and `pnpm typecheck` pass. `pnpm test`: 957 passed, 9 skipped
  (948 before; the token contrast test grew from 1 case to 10).
- Class rename was one for one: 61 `*-ink` classes became `*-canvas`, 198
  `*-paper` classes became `*-ink`, and no `*-paper` class remains.
- Browser on the local dev server: `/`, `/demo`, `/pricing`, `/sign-in` and a
  404 at 1440px; `/` at 1024px; `/` and `/demo` at 390px and 320px. Colours
  map to the same roles as before, the body grid and glows are gone, and no
  page scrolls sideways.
- Not yet changed, by design: Bricolage is still the display face, the demo
  still uses its own hex palette, and the infinite animations still run. Steps
  2 and 3 handle them. The signed-in workspace was not checked (needs a login).

### Step 2: marketing shell and landing (November 3, 2026)

- New `Aperture` in the hero, drawing a recorded localization of
  shadcn-ui/taxonomy for "the post editor loses changes on save": 14 of 125
  files, 6,448 of 56,404 tokens, no Widen. It replaces the hand-made
  "Illustrative example" card.
- Hero: one headline, one sentence, one primary action ("Localize a public
  Repo") and a text link to the demo. The pill, the stacked eyebrow and the
  third button are gone. The Agent Run request and the admission tag moved to
  the Agent Runs section, where they apply.
- Teal now appears only on Slice marks and Anchor labels. The second headline
  line is `--muted`, and the closing band uses `data-band="dark"` with an
  inverted primary button instead of mint.
- Header is solid (no blur); nav and buttons use `rounded-chip` and
  `rounded-card`; buttons press to 0.97 and hover by colour only.
- Bricolage is retired site-wide. Every display heading is Geist, and 16
  headings tracked tighter than `-0.04em` were brought up to it.
- No em dashes on the landing page; its test now asserts that.
- Kept on purpose: the landing stays at `max-w-7xl` so it lines up with every
  other page. Moving all pages to 1200px is step 5.
- `pnpm lint`, `pnpm typecheck` and `pnpm check:alpha-claims` pass.
  `pnpm test`: 963 passed, 9 skipped. New: `landing-slice.test.ts` (record
  matches the localizer) and `Aperture.test.tsx` (one mark per file, closes once
  in view, closed at once under reduced motion).
- Browser at 1440, 1024, 390 and 320px: no sideways scroll, file names
  readable, the list expands to all 14 files. Reduced motion is covered by the
  jsdom test, not by browser emulation.
- Screenshots: `landing-before-1440.jpg` (the live site),
  `landing-after-1440.jpg`, `landing-after-390.jpg`.

### Step 2b: motion and print grammar (November 3, 2026)

Prompted by a closer study of Continuity's frontend: its feel comes from
mechanism animations driven by real output, one signature visual, small motion
pieces that play once, a print layout, and colour restraint.

- Canvas moved from a cool green-grey to neutral paper (`#F4F3EF`); navy ink
  and the state colours stay. The contrast test still holds AA everywhere.
- Landing recomposed as a numbered sheet: a full-width headline that rises on
  load, then 01 The Slice (Fig. 1, the aperture, now full width with the field
  beside the file list), 02 Mechanism (Fig. 2), 03 Evidence (numbers count up),
  04 Agent Runs, and the closing band. Margin rails, crosshair rules and
  figure captions throughout.
- Fig. 2 plays the recorded run's 12 one-hop imports; `landing-slice.ts` now
  records the Slice's import edges and its test checks them against the graph.
- Not done, on purpose: a hero headline built from particles. That is
  Continuity's signature; Locus's is the file-mark field.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:alpha-claims` pass. `pnpm test`:
  975 passed, 9 skipped. New: `Reveal.test.tsx`, `Mechanism.test.tsx`.
- Browser at 1440, 1024, 390 and 320px: no sideways scroll; Fig. 2 lines land on
  their files at 1024 and up and stack below; every beat completes. Fixed on the
  way: counts overshot their start for a frame (negative progress), and a long
  Anchor path overflowed its card on phones.
- Screenshots: `landing-v2-hero-1440.jpg`, `landing-v2-fig2-1440.jpg`,
  `landing-v2-fig2-390.jpg`.

### Steps 3 to 6: the rest of the site (November 3, 2026)

- **Demo (step 3):** `MigrationDemo` runs on the dark token band. Its 40-odd
  hex colours, the orbiting ring, the pulsing core and every glow are gone; the
  play button is the ink primary; the dark band gained readable `--widened` and
  `--failed` values, and the contrast test covers them.
- **Public pages (step 5):** headings rise on load; the margin rails moved into
  `MarketingShell` so every public page has them, behind section backgrounds;
  the dotted rulers became hairlines; page titles and visible copy lost their
  em dashes (API strings and code comments left as they are).
- **App (step 4):** the hand-drawn `ContextLens` is replaced by
  `WorkspaceField`, the same file field as Fig. 1 drawn from the user's own Repo
  and Slice. It scans only while work is running, and a Repo over 600 files
  draws one mark per group of files. The workspace stage is no longer a navy
  frame; on `main` its Repo name was navy text on that navy frame, so it was
  invisible.
- **Shape and type, site-wide:** 107 card radii and 30 chip radii collapsed to
  `rounded-card` and `rounded-chip`; 73 uses of 8 to 10px text raised to 11px;
  57 label trackings unified; custom shadows became `shadow-panel`; blurs and
  hover lifts removed.
- **Aliases retired (step 6):** `accent`, `recent`, `line-strong`,
  `muted-light` and `surface-raised` are gone. Each use was mapped by meaning:
  buttons to the ink primary, states to `included`, the Widened ledger to
  `widened`, errors to `failed`, the Recent signal to ink.
- No hex colour remains in a component except Clerk's appearance config and the
  social image, which need literal values and mirror the tokens.
- Checks: `pnpm lint`, `pnpm typecheck`, `pnpm check:alpha-claims` pass;
  `pnpm test` 984 passed, 9 skipped. Browser: every public page at 1440, and
  no sideways scroll at 390 and 320. Not checked in a browser: the signed-in
  workspace, which needs a Clerk login; `WorkspaceField.test.tsx` covers it.

### The live Slice (November 3, 2026)

Fig. 1 stopped being a picture of a run and became the product. Continuity's and
PigeonBox's demos look live but take no input; this one takes any task.

- `Aperture` runs the real localizer in the visitor's tab on the bundled copy
  of shadcn-ui/taxonomy, with the real `FilePanel` (In and Out lists, real
  source). No sign-in, no server call.
- It plays by itself once (types a task, localizes it, then a second one) and
  then hands over. Touching the figure or scrolling away ends the self-play for
  good. The server renders the recorded run, so it is complete without
  JavaScript. Reduced motion skips the self-play.
- A task with no confident match Widens to all 125 files and says so, naming the
  words it could not find and offering words the Repo does use.
- Access: `/repos` stays behind sign-in, unchanged. `lib/landing-engine.ts`
  imports only taxonomy as a code chunk (45 KB gzipped, loaded after the page),
  which makes this one public Repo downloadable by signed-out visitors.
- Measured on a production build, driven as a visitor with real clicks and keys:
  14 files at 3.1 s, 6 at 9.0 s, hand-over at 11.6 s; zero fetch, XHR, beacon or
  resource requests while typing and submitting a task with a unique marker
  word, and the word appears in no captured traffic; zero CSP violations; figure
  height stable at 709 px at 1440; no sideways scroll at 1440, 1024, 390, 320.
  HTML, script tags, regex characters and Unicode are handled safely.
- Fixed from that test: the page jumped as the Slice size changed (list height is
  now fixed); the Repo and Slice counts overlapped mid-crossfade; the old task had
  to be cleared by hand (clicking in now selects it); the engine pulled in the
  list of other bundled Repos; "tsx" was offered as a word to refine with.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:alpha-claims` pass. `pnpm test`: 991
  passed, 9 skipped. `Aperture.test.tsx` locks in the no-network promise.
- Not checked: reduced motion in a real browser (jsdom only); a phone's soft
  keyboard; a real Vercel deployment, where Analytics and Speed Insights also
  run. They load on their own and do not read the input, but only localhost was
  measured. The Run chapter is not built: it needs a recorded real Run.
- Screenshot: `landing-live-1440.jpg`.
