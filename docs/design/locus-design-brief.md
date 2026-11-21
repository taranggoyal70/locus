# Locus design brief: the evidence datasheet

The reference for every Locus surface: palette, type, the Slice aperture, motion
and copy rules. Write the brief first, then build against it. Change the brief
when a decision changes, not the code alone.

## Purpose

Locus sells one idea: an agent should see the task, not the Repo, and you should
be able to check what it saw. The page has to make that visible in a few seconds
and then hold up under a skeptical engineer's second look.

The look is a technical datasheet, set like a well-printed form. Warm grey
paper, near-black ink, a regular-weight serif for display headings, hairline
rules, mono for data, and one orange signal that only ever marks the Slice.
Every other colour is a Check's or file's state. It follows the system into
a full dark theme. The signature is the **aperture**: a Repo drawn as a field of
files that closes onto the Slice. It is the only illustration Locus needs.

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

What already works and stays: the navy and teal identity (until November 20,
2026; see "The palette" under Avoid), Geist and Geist Mono,
the evidence strip that states its own limits, the Locate / Implement / Check /
Review sequence, and the aperture idea in `ContextLens` and `MigrationDemo`.

## Reference study (November 3, 2026)

Principles to adapt, not layouts or assets to copy.

- [Continuity](https://continuity-demo-tau.vercel.app/) by Aiden Guan, and its
  [source](https://github.com/aiden-guan/continuity/tree/main/site): the closest
  match in spirit. A whole system in one short token block: two surfaces, two
  line weights, four ink weights, one signal colour plus a "check passed" green,
  one ease, two radii (6px and 10px). Adopt the datasheet discipline and the
  rule that colour means "something changed." Its palette is Locus's palette
  since November 20, 2026: paper, ink, graphite, the orange signal and the
  green. Aiden Guan, its author, cleared the reuse. (Its orange and warm paper
  were on this avoid list until then; "The palette" under Avoid says why they
  came off.)
- [PigeonBox design docs](https://github.com/aiden-guan/pigeonbox/tree/main/docs/design):
  the process this brief follows. Dated references with adopt and avoid notes, a
  six-role palette table, motion in exact milliseconds, an explicit avoid list,
  and browser verification at real widths.
- [PigeonBox](https://usepigeonbox.com), the site itself (November 19, 2026; full
  study in [`pigeonbox-study.md`](pigeonbox-study.md)): the main visual
  reference since November 20, 2026. Adopt the regular-weight serif headline
  with a muted second line, warm paper, two border weights (a hairline
  separates, a 1px ink border marks one object), 4px and 8px radii, numbered key
  caps in the nav, ruled lists, a ticket-style closing panel, a dark footer band
  and its motion timings. Avoid its copper accent, its halftone drawings and
  mascot, its copy, and its decorative loops. Do better where it falls short:
  a dark theme on the public pages too, labels no smaller than 11px, and a
  loaded serif instead of an OS-dependent `ui-serif`.
- [Amp](https://ampcode.com/): one warm accent used only on the primary action,
  and real task strings floating in the hero instead of abstract shapes. Adopt
  real task text as imagery. Avoid the dark atmospheric gradient.
- [PlanetScale](https://planetscale.com/): mono used with confidence, dense
  honest prose, bordered buttons. Adopt the willingness to be plain and dense.
  Avoid all-mono body text, which is tiring past one screen.
- [Linear](https://linear.app/) and [Graphite](https://graphite.com/): a quiet
  nav with one solid button and nothing competing with it. Adopt the single
  primary action per view. Both are dark-first. Locus is daylight first, which
  sets it apart from most agent tools, and follows the system into dark.
- [shadcn/ui](https://ui.shadcn.com/) and
  [Emil Kowalski's animation tips](https://emilkowal.ski/ui/7-practical-animation-tips):
  predictable controls, quiet borders, immediate press feedback, short ease-out,
  menus that grow from their trigger. Use the principles. Do not add a component
  library for a visual refresh.

## System

### Palette

Rename the tokens so names match roles, and move every hex literal in
components onto them. Each token is also a Tailwind colour of the same name
(`bg-canvas`, `text-ink-2`, `border-line-2`, `text-included-ink`). The values
are Continuity's (November 20, 2026), with the changes noted.

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#F3F2EE` | Page background (warm grey paper) |
| `--canvas-2` | `#EAE8E2` | Recessed band (the closing ticket section, table heads) |
| `--surface` | `#FBFAF8` | Cards, panels, inputs |
| `--surface-2` | `#E4E2DC` | Wells, active nav items, skeletons (Locus's own) |
| `--line` | `rgba(22, 21, 19, 0.09)` | Default hairline |
| `--line-2` | `rgba(22, 21, 19, 0.17)` | Emphasised hairline, input borders |
| `--ink` | `#161513` | Headlines, body, primary button, object borders |
| `--ink-2` | `#44423D` | Supporting text |
| `--muted` | `#67645E` | Captions, metadata, the second headline line. Continuity's `#7B7871` is 3.9:1 here, so the hue is kept and the value darkened to AA on every ground |
| `--included` | `#E2501D` | The signal: Included marks, the Slice's bars and fills, focus ring (3.5:1, a graphic) |
| `--included-ink` | `#B0380E` | The signal as text: Included counts, labels, Anchor paths (Continuity's `#B93C10`, darkened to AA on wells) |
| `--passed` | `#286F45` | Passed Checks, success, completed steps (Continuity's `#2C7A4B`, darkened to AA on wells) |
| `--widened` | `#7A6000` | Widen, attention needed (ochre, so it never reads as the signal) |
| `--excluded` | `#D3D0C7` | Excluded files (always paired with a label) |
| `--failed` | `#B42346` | Failed Checks and errors only (crimson, so it never reads as the signal) |

The same roles have two dark sets. Each is the same tokens with swapped values,
so components never branch on the theme.

| Token | Dark band | Dark theme |
| --- | --- | --- |
| `--canvas` | `#161513` | `#0F0F0E` |
| `--canvas-2` | `#11100F` | `#0A0A09` |
| `--surface` | `#1F1E1B` | `#171716` |
| `--surface-2` | `#282724` | `#201F1D` |
| `--ink` | `#ECEAE4` | `#ECEAE4` |
| `--ink-2` | `#B8B5AD` | `#B8B5AD` |
| `--muted` | `#939088` | `#8A877F` |
| `--included` | `#FF6A3D` | `#FF6A3D` |
| `--included-ink` | `#FF8A64` | `#FF8A64` |
| `--passed` | `#5DC48A` | `#5DC48A` |
| `--widened` | `#E2B341` | `#E2B341` |
| `--excluded` | `#2F2E2A` | `#2B2A27` |
| `--failed` | `#FF7A8A` | `#FF7A8A` |

- **Dark band** (`data-band="dark"`): the demo, the pricing contract half, the
  evidence thresholds and the footer. In the light theme it is the only dark
  ground on the page: the ink itself (`#161513`). Inside the dark theme it sits
  one step deeper (`--canvas` `#0A0A09`, `--surface` `#121211`) so it still
  reads as a band.
- **Dark theme**: Continuity's graphite, a near-black that is not blue. It follows
  `prefers-color-scheme` unless the reader pins Light or Dark with the switch in
  the footer, the auth pages or Settings (stored in `localStorage` as
  `locus-theme`). A blocking script in `<head>` sets `data-theme` before first
  paint, so a pinned theme never flashes the other one; it carries the CSP nonce.
- Hairlines on the dark grounds are the warm paper at 8% and 15%, not white, so
  they stay in the same family as the text.
- Clerk's widgets take literal colours, so `src/lib/clerk-palette.ts` mirrors the
  surface, canvas, ink, ink-2, failed and passed values for each theme, and the
  components pick a palette from the resolved theme.

`src/app/design-tokens.test.ts` holds every text role (ink, ink-2, muted,
included-ink, passed, widened, failed) above 4.5:1 on canvas, canvas-2, surface
and surface-2 in all four grounds (light page, dark band, dark theme, band inside the dark
theme), holds the signal above 3:1 as a graphic on the same grounds, checks that
the system-setting copy of the dark theme matches the pinned one, and checks the
Clerk palette against the tokens.

**Colour rule:** the orange signal marks the Slice: Included files, their counts
and Anchor paths, the bars that measure them, and the focus ring. Green means
passed or done, ochre means Widened, crimson means failed, and grey means
Excluded. None of them is decoration. If a coloured element means none of
these, make it ink. That includes navigation (the current page's key cap is
filled with ink), selected options (an ink border) and links (ink with a
hairline underline that darkens on hover). Text in the signal uses
`--included-ink`; `--included` is for marks, rings and fills.

### Type

- **Newsreader** for display only: page and section headings, phase names,
  large figures. Regular weight (400), tracking `-0.02em`, line-height about
  0.98. Self-hosted through `next/font/local` with its optical-size axis, so
  large headings get the fine display cut, small ones the sturdier text cut,
  and every OS renders the same face. The file is Google's Latin subset with
  the weight axis fixed at 400 (57 KB, against 132 KB for every weight), so a
  heavier serif needs a new file, not a class. Hero
  `clamp(46px, 9.4vw, 136px)`; page titles `clamp(40px, 6vw, 80px)`; section
  heads `clamp(32px, 4.4vw, 56px)`.
- Headings are two short lines, the second in `--muted`: a statement, then its
  consequence ("Ship the task." / "Not the repo.").
- **Geist** for everything readable, **Geist Mono** for data and for the label
  voice: file paths, counts, hashes, statuses, commands, section labels and key
  caps. Bricolage stays retired.
- Text scale: 12, 13, 15, 17, 20. Body 15 or 17. **Nothing below 11px**, and
  mono labels are 11px minimum.
- Uppercase eyebrows: at most one per section, `0.08em` tracking, and only when
  it names something (a step number, a state). Never stack two.
- `tabular-nums` on every number that can change.

### Shape and surface

- Three radii: `4px` (`rounded-chip`: buttons, chips, inputs, key caps, file
  rows), `8px` (`rounded-card`: cards, panels, the ticket), `999px`
  (`rounded-full`: status dots only).
- **Two border weights.** A hairline (`--line`, `--line-2`) separates. A 1px ink
  border marks one object you should treat as a unit: the ticket, the pricing
  panel, the gate card, the auth card, and the top rule of a ruled list.
- Borders do the work. `shadow-panel` for raised panels
  (`0 1px 0 rgba(20,35,59,.04), 0 12px 32px -18px rgba(20,35,59,.24)`);
  `shadow-frame` only for a dialog.
- No full-page grid, no radial glows, no blurred halos, no glass. The grid
  belongs inside the aperture figure, where it means "the Repo."

### Layout

- Max width 1200px; gutter `clamp(16px, 4vw, 40px)`; section spacing 96px
  desktop, 64px phone.
- One primary action per view. Secondary actions are text links or a single
  outlined button.
- **Header:** 60px, solid canvas, hairline below. The serif wordmark, then nav
  items each with a numbered key cap (1 Demo, 2 Evidence, 3 Docs, 4 Agent
  access). The numbers are real shortcuts: pressing one follows its link unless
  focus is in a field. Then Source and Sign in as text, and one solid ink "Try
  Locus" button. Under 1024px the nav moves into a menu that grows from its
  button.
- **Footer:** a full-width dark band with the file field drawn across it, link
  columns (three across on phones too), the admission sentence and the theme
  switch.
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
`--included` and the count says so. Ochre `--widened` belongs to Agent Runs,
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
- **Ruled lists:** numbered rows under an ink top rule: a mono number, a serif
  title, a sans description, an optional action. Used for the Run phases,
  support channels, the protocol and the case ledger instead of cards.
- **Ticket:** the closing panel is a single ink-bordered card with a perforated
  stub (a dashed rule with notches cut into the edge) that lists the terms like
  a boarding pass, stamped with a postmark drawn from the Slice.
- **Reference pages** (docs, legal): sections open on an ink rule with a mono
  number; docs get a sticky "On this page" rail at desktop widths.
- `PageHeader` (`src/components/PageHeader.tsx`) opens every secondary public
  page the same way: mono label, two-line serif title, lead paragraph, and an
  optional aside that steps the title down a size.

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

Italic headings, a serif in bold or semibold, serif body text, gradient text,
mint glow, glassmorphism, floating icon confetti, a row of three identical
feature cards, numbered feature lists used as decoration, fake trust logos,
testimonial carousels, endless background animation, more than one accent
colour on a screen, navy or slate-blue greys, a blue-black dark theme, mint or
teal accents, orange used as decoration rather than as the signal, and any mono
uppercase text under 11px.

**Changed November 20, 2026.** This list ruled out a display serif, and the
Continuity note ruled out warm paper. Both came off when PigeonBox became the
main visual reference. The reasoning:

- A serif headline on warm paper is what makes a page read as a printed form
  rather than a SaaS template. That is the datasheet idea taken one step
  further, not a different idea, and it sets Locus apart from the dark, sans,
  gradient look most agent tools share.
- The original worries were a serif that looks different on every OS and a
  warm page that borrows someone else's identity. The first is handled by
  loading Newsreader instead of relying on `ui-serif`. The second is handled
  by keeping everything that is Locus's own: navy ink, teal as the only colour
  and only for state, the file field as the only illustration, and no copper.
- Only at regular weight, and only for display. A bold serif turns an editorial
  page into a magazine cover, and a serif in dense UI text costs legibility.

**The palette (changed again November 20, 2026).** Navy ink, slate-blue greys,
a navy dark theme with a mint accent, and beige paper together read as a
generated template, which is the opposite of a page an engineer should trust.
The palette is now Continuity's, adopted with its author's agreement: warm grey
paper, warm near-black ink, graphite for dark, one orange signal and one green.
The reasoning:

- Neutral greys and a near-black that is not blue take away the template look
  without adding anything. Orange is the only colour left that draws the eye,
  so it can carry the one thing the page is about: the files in the Slice.
- Continuity has two colours; Locus has five states. Orange takes Included and
  green takes passed, as in Continuity. Widened moves to ochre and failed to
  crimson, far enough from orange that a failure never reads as part of the
  Slice and the reverse. Each still sits beside a label, so no state depends on
  hue alone.
- Three Continuity values change for accessibility: muted is darkened to 4.5:1,
  orange text uses a darker ink (`#B0380E`) while marks and rings use the
  brighter signal, and the green darkens a step, so every text colour clears
  4.5:1 on wells and table heads as well as the page.

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

### The PigeonBox layer (November 20, 2026)

PigeonBox became the main visual reference (study: `pigeonbox-study.md`). The
datasheet stays; its type, canvas and object grammar changed.

- **Type:** display headings moved to Newsreader at regular weight with a muted
  second line, site-wide (25 headings rewritten from 600 weight and tight
  tracking to 400 at `-0.02em`). Geist and Geist Mono are unchanged.
- **Palette:** a warmer paper (`#F3F1EA`), a new `--canvas-2` for recessed
  bands, and a full dark theme that follows the system, with a Light, Dark and
  System switch in the footer, on the auth pages and in Settings. Radii went to
  4px and 8px.
- **Shell:** a 60px header with numbered key caps that work as shortcuts, a
  phone menu, and a dark footer band with the file field and link columns.
- **Pages:** the landing closes on a ticket with a postmark; pricing is one
  ink-bordered panel split into paper and band; support, evidence and the
  protocol use ruled lists; docs and legal pages share reference styles and a
  `PageHeader`; the 404 and error pages, the access dialog, the auth shell, the
  settings shell and the workspace rail follow the same grammar. Clerk's
  widgets take the theme's palette.
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm check:merge-markers`,
  `pnpm check:alpha-claims`, `pnpm evidence:release1` and `pnpm check-sync`
  pass. `pnpm test`: 1016 passed, 9 skipped; the token test grew from 12 cases
  to 27 (dark theme, band inside the dark theme, the two dark-theme copies
  agreeing, and the Clerk palette).
- **Browser (Chromium):** every public page at 1440 and 390 in light and dark;
  no sideways scroll at 1440, 1024, 390 and 320 on any public page, the 404 or
  the auth pages. The access dialog, the settings shell and the workspace were
  checked in both themes through a temporary unauthenticated route, removed
  before commit.
- **Fixed on the way:** Settings rendered the Cloudflare panel twice (also on
  `main`); the key cap's style sat outside Tailwind's layers, so the current
  page's key never changed; the frame shadow's theme variable pointed at
  itself; numbers shrank on phones through a leftover `.tabular` rule.
- **Not checked:** signed-in pages with a real Clerk session, so Clerk's own
  account menu and profile were not seen in dark; Safari and Firefox. Clerk's
  development-mode widget logs a CSP warning for a `data:` image, on the base
  branch too.
- Screenshots, before and after side by side: `pigeonbox-landing-1440-light.jpg`,
  `pigeonbox-landing-1440-dark.jpg`, `pigeonbox-landing-390-light.jpg`,
  `pigeonbox-landing-close-1440-light.jpg`, `pigeonbox-pricing-1440-light.jpg`,
  `pigeonbox-docs-1440-light.jpg`, `pigeonbox-evidence-1440-light.jpg`,
  `pigeonbox-support-1440-dark.jpg`, `pigeonbox-sign-in-1440-dark.jpg`.

### The launch pass (November 20, 2026)

Launch readiness, then the depth PigeonBox and Continuity have and Locus
lacked, read from their source rather than their screenshots
(`depth-comparison.md`).

- **Palette:** Continuity's, recorded under Palette above: warm paper and ink,
  a graphite dark theme, and one orange signal for the Slice. The mark,
  favicon, Apple icon and social card follow it.
- **Fonts:** Newsreader is self-hosted at a fixed 400 weight with its
  optical-size axis, 57 KB instead of 132 KB. Fonts weigh 108.7 KB on every
  page, down from 181.5 KB. While the serif loads, a stand-in sized with the
  overrides `next/font/google` derives keeps every heading's line breaks;
  sized from the file itself, as `next/font/local` does by default, it
  re-wrapped the evidence header on phones as the serif arrived (layout shift
  0.14).
- **Nothing moves while a page loads.** On a production build in Chromium, on
  desktop and on a phone profile (150 ms RTT, 1.6 Mbps, 4x CPU), cumulative
  layout shift is at most 0.0027 on every public page and sign-in. All 164
  serif headings keep their height when the font swaps in, at 390, 768, 1024
  and 1440. Two needed help: the evidence headings now break by line, and the
  pricing panel's heading is capped by its card's width (at 768 it had 7px to
  spare). The sign-in placeholder is as tall as Clerk's card, so the card
  replaces it in place.
- **Speed:** largest contentful paint is 192 to 432 ms on desktop and 1.45 to
  1.54 s on the phone profile. The first case board drew one element per file
  mark, about 700 of them, and pushed the phone landing from 1.45 s to about
  1.7 s. Each row now draws its marks from at most four tiled elements on a
  whole-pixel grid, and the landing measures 1.47 to 1.54 s over four runs,
  level with pages that have no board.
- **Accessibility:** axe-core (WCAG 2.2 AA and best practice) on every public
  page, the workspace and settings, in both themes, on desktop and phone, is
  clear except Clerk's "Secured by" line, which only development instances
  draw. Every text role is checked at 4.5:1 on all four grounds.
- **Depth** (`depth-comparison.md`):
  - Fig. 3, the case board: all 15 fixes in the benchmark, one mark per source
    file on one scale, opened by hover, focus or tap, each case linked to its
    fix and snapshot commits. It reads `benchmarks/results.json`, as now do the
    numbers above it.
  - Replay on Fig. 2.
  - A command menu (⌘K or Ctrl+K, or the header's Search): pages, doc
    sections, short answers that restate published copy, and the theme.
- **Signed-in pages,** checked with a real session in the app's browser:
  Workspace, Agent Runs and Settings have page titles; the context trace's
  header follows its panel's width, so it no longer cramps beside the ranked
  list; the Agent Run heading is in the serif, and status chips take the chip
  radius. The account page's sidebar title stays in Clerk's sans: Clerk gives
  it no appearance key, and a selector into Clerk's markup made Clerk warn on
  every page that loads it. Clerk's answer is to pin its UI with `@clerk/ui`,
  a dependency decision of its own.
- **Browsers:** Chromium throughout, and WebKit (Playwright's build): every
  public page, the 404 and the auth pages at 1440 and 390 in both themes (44
  loads, no sideways scroll; the console errors are the Vercel Analytics and
  Speed Insights scripts, which exist only on a deployment, and on the auth
  pages the image Clerk draws only on development instances, which the CSP
  blocks), and the case board, command menu, Replay and the pricing heading
  driven by script in both engines. That run caught the command menu's results
  list collapsing to nothing in WebKit, which resolves a 0% flex basis to zero
  in a dialog whose height is not set; the list now takes its content's height
  and scrolls inside the cap.
- **Checks:** `pnpm lint`, `pnpm typecheck`, `pnpm check:merge-markers`,
  `pnpm check:alpha-claims`, `pnpm evidence:release1`, `pnpm check-sync` and
  `pnpm build` pass. `pnpm test`: 1041 passed, 9 skipped, with new suites for
  the case board and the command menu, and Replay cases for Fig. 2.
- **Not checked:** Firefox (macOS's sandbox stops Playwright's Firefox from
  starting here); Safari on a real phone; a real Vercel deployment; Windows
  forced colours, where the case board's marks switch to system colours by CSS
  that was not seen rendered.
- Screenshots: the nine `pigeonbox-*.jpg` sheets above, retaken on this build,
  and `depth-case-board-1440-light.jpg`, `depth-command-menu-1440-light.jpg`.
