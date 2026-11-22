# PigeonBox design study

A close reading of PigeonBox's visual language, as input for the Locus redesign.
Studied November 19, 2026. Principles to adapt, not text, logos, illustrations
or assets to copy.

## What it is

PigeonBox is a Gmail Chrome extension by Aiden Guan. It sorts the inbox,
summarizes threads, drafts replies and answers questions about your mail, and it
never sends anything for you. It runs locally by default (MIT licensed), with a
paid hosted tier in beta.

- Site: <https://usepigeonbox.com> (landing, `/docs`, pricing, local, cloud)
- Source: <https://github.com/aiden-guan/pigeonbox>, including its own design
  notes in `docs/design-system.md` and `docs/design/`
- Creator: <https://aidenguan.com>, who also made Continuity, which the Locus
  brief already studies

Everything below was measured on the live site at 1440px and 375px wide with
computed styles read from the page, plus the product token file
`apps/extension/src/ui/product-tokens.css` for the extension's dark theme.

## The idea in one line

A correspondence desk: warm paper, near-black ink, an old-style serif for
headlines, a monospace voice for labels and metadata, hairline rules everywhere,
and one copper accent that marks the one thing you should notice. It reads like
a well-set printed form, not like a SaaS template.

## Layout and grid

- **Container:** `max-width: 1240px`, gutter `clamp(16px, 4vw, 40px)`. The
  content column is 1160px at 1440 wide.
- **Header:** 60px tall, sticky, paper at 92% opacity with
  `backdrop-filter: saturate(1.2) blur(10px)` and a 1px `--rule` bottom border
  that fades in once scrolled.
- **Hero:** two columns, roughly 5/7. Left: mono eyebrow, a stacked serif
  headline, a 19px lead paragraph, a solid primary and an outlined secondary button
  stacked or side by side. Right: a large product demo (a browser frame) with a
  caption bar and numbered step chips under it. A faint halftone dot drawing sits
  behind the frame's top-right corner.
- **Sections:** `102px` vertical padding at desktop. Each section opens with a
  header row: a mono label on the left, a mono status on the right, a 1px rule
  under both, then a two-line serif heading.
- **Feature row:** five equal columns separated by 1px vertical rules and capped
  by a 1px **ink** top rule (not a hairline). Each column: a small dot-matrix
  glyph, a mono label, a serif h3, a tiny two-row status table ("Local /
  Included"), then two lines of body. No card backgrounds, no shadows. On phones
  the columns become rows with the glyph on the left.
- **Split panel:** one 8px-radius box with a 1px ink border, split into a paper
  half and an ink half. The contrast between the two halves *is* the comparison.
- **Closing call to action:** a "ticket": a sheet-coloured panel with a 1px ink
  border, 8px radius, a dashed perforation line down the right third with
  semicircle notches cut into the top and bottom edges, and a stub that lists
  key/value rows like a boarding pass.
- **Footer:** full-bleed ink band, an animated halftone city scene with the
  wordmark set in dots, then a four-column link grid and a mono legal line.

## Typography

| Role | Family | Size | Tracking | Leading | Weight |
| --- | --- | --- | --- | --- | --- |
| Hero h1 | `ui-serif, "Iowan Old Style", Charter, "Source Serif 4", Georgia` | 58px at 1440 (fluid) | -0.022em (-1.28px) | 0.98 | 400 |
| Section h2 | same serif | 62px | -0.02em | 1.02 | 400 |
| Card h3 | same serif | 26px | -0.012em | 1.12 | 400 |
| Body | system sans (`-apple-system, system-ui`) | 16px | normal | 1.55 | 400 |
| Lead | system sans | 19px | normal | 1.55 | 400, `--muted` |
| Eyebrow / label | system mono (`ui-monospace, "SF Mono"`) | 11px | 0.14em | 1.3 | 500, uppercase |
| Tag | mono | 10.5px | 0.12em | 1 | 500, uppercase, 1px border, 2px radius |
| Buttons | system sans | 14 to 15px | -0.005em | 1 | 500 |
| Footer links | system sans | 14.5px | normal | 1.55 | 400 |

Observations:

- **The serif carries the personality.** Every heading is a regular-weight
  (400) old-style serif with modest negative tracking. Nothing is bold. The
  second line of the hero and of section heads switches to a slate grey
  (`--pigeon-deep`), so the heading reads as statement then consequence.
- **Mono is a voice, not decoration.** It is used for things a form would
  print: section labels, statuses, step numbers, keyboard keys, legal lines.
- **No web fonts.** All three families are system stacks. The page is fast and
  looks native on a Mac; on other systems Charter or Georgia stand in.

## Colour

Marketing site (light only; dark appears as bands, not as a theme):

| Token | Value | Role |
| --- | --- | --- |
| `--paper` | `#f3f0e8` | Page background, warm off-white |
| `--paper-2` | `#ebe7dd` | Recessed band (closing section) |
| `--paper-3` | `#e2ddd1` | Deeper well |
| `--sheet` | `#faf8f3` | Raised paper: ticket, key caps |
| `--rule` | `#d5cfc2` | Default hairline |
| `--rule-strong` | `#bdb6a7` | Outlined button border |
| `--text` | `#18191b` | Ink |
| `--muted` | `#565a61` | Lead and labels |
| `--faint` | `#7a7e85` | Metadata |
| `--pigeon-deep` | `#4b5664` | Second heading line |
| `--copper` | `#a8502c` | The one accent: active nav key, "beta" status, a dot |
| `--copper-wash` | `#f1ded2` | Accent background |
| `--signal` | `#2f7d4c` | "Ready" dot |
| `--ink` | `#111214` | Dark bands, primary button |
| `--ink-text` | `#ebe7de` | Text on ink |
| `--ink-rule` | `#2e3237` | Hairline on ink |

Product dark theme (the extension and dashboard follow the OS setting):
surface `#111214`, raised `#191b1e`, inset `#1e2024`, foreground `#ebe7de`,
secondary `#a3a9b1`, border `#2e3237`, strong border `#41464e`, accent
`#e48a65` (copper lifted for contrast), success `#6cc890`. In other words dark
mode is the ink band promoted to a whole theme: the same warm off-white text on
a near-black that is not blue.

## Spacing, borders and radii

- **Spacing scale:** 4, 8, 12, 16, 20, 24, 32, 40px in product; marketing
  sections use about 72px above the hero and 102px between sections.
- **Two rule weights:** `1px --rule` for separation and `1px --text` (full ink)
  for the edges of anything you should treat as a single object (the feature
  row, the split panel, the ticket). This is the most transferable idea on the
  page: borders say what belongs together, ink borders say "this is a unit".
- **Radii:** 4px for buttons, key caps and the command button; 2px for tags;
  8px for panels; 12px only for the product demo frame. No pills.
- **Shadow:** one, on the demo frame only:
  `0 32px 70px -36px rgba(30,33,38,.4)` plus a 5px `--paper-2` ring that reads
  as a mat around a print. Everything else is flat.

## Navigation

- Brand mark (a small pixel pigeon) plus the serif wordmark at 21px.
- Nav items carry a **key cap**: a 16px mono letter in a 3px-radius sheet box
  (`P`, `L`, `C`, `$`, `D`). The active item's key turns copper. The keys are
  real shortcuts and double as a visual rhythm.
- Then a quiet "Sign in" text link, a bordered `⌘K` command button, and one
  solid ink "Install" button with a `↗` glyph. Exactly one solid button in the
  header.
- Phone: the wordmark, the `⌘K` button and a menu button, each a square button
  with a 1px border.
- Docs reuse the same header; the docs index is a numbered list of rows (mono
  number, serif title, sans description, `↗`) separated by hairlines.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `--ease` | `cubic-bezier(.22, 1, .36, 1)` | Everything |
| `--ease-io` | `cubic-bezier(.65, 0, .35, 1)` | Symmetric moves |
| `--t-hover` | 160ms | Colour and background on hover |
| `--t-content` | 280ms | Header border, content swaps |
| `--t-reveal` | 520ms | Sections fade and rise once when they scroll in |

- Six `.reveal` blocks fade up by a few pixels the first time they enter view.
- The hero demo is a scripted walkthrough of the product with pause and expand
  controls and four numbered step chips; the active step is copper.
- Halftone dot drawings shimmer slowly; the footer scene has a pigeon you can
  send across the sky by clicking.
- `prefers-reduced-motion` is honoured: smooth scroll and reveals turn off.
- Hover changes colour only. Nothing lifts or scales on hover.

## Empty and secondary states

The marketing site has no empty states of its own. The product notes describe
the attitude: empty is quiet, not alarming ("do not imply a network failure for
an empty inbox"), states always carry words as well as colour, a small mascot
pose signals the state, and nothing loops unless real work is running.

## What makes it distinctive

1. **Serif headlines on warm paper**, set at regular weight with a two-tone
   second line. It feels editorial and calm where most developer tools shout.
2. **The printed-form grammar:** mono labels in the margins, status tables,
   step numbers, key caps, a ticket stub. Metadata looks like metadata.
3. **Ink borders for objects, hairlines for separation.** No cards-with-shadows.
4. **One accent, used sparingly.** Copper marks the active thing, never
   decoration.
5. **A single crafted illustration language** (halftone dots) reused for
   feature glyphs, the hero backdrop and the footer.
6. **System fonts only**, so it loads instantly and looks native.

## Where it falls short (and where Locus can do better)

- **No dark theme on the marketing site.** The product has one; the site does
  not, so a visitor in dark mode gets a bright page. Locus should ship both.
- **Small mono text.** Labels at 10 to 11px and tags at 10.5px are hard to read,
  especially in grey on paper. Locus's floor is 11px with 12px preferred.
- **The hero demo is a static-looking frame** at first paint (a blank white box
  before the script loads, visible in our first capture). Locus already renders
  its recorded Slice on the server, so the hero is complete without JavaScript.
- **Long phone pages.** The five-column feature row becomes five tall rows on a
  phone. Tighter phone layouts would help.
- **Decorative motion that never stops** (the halftone shimmer, the footer
  scene). Locus's rule is that loops only run while real work runs.
- **Serif fallback varies by OS.** `ui-serif` is New York on Apple and Georgia
  elsewhere, so the look drifts. A loaded serif keeps it consistent.

## Implications for Locus

Borrow: the paper and ink palette idea with a single accent, a regular-weight
serif for display headings with a muted second line, mono for labels and data,
two border weights (hairline vs ink object borders), flat surfaces with one
framed shadow for the hero figure, key-cap nav details, the ticket-style closing
panel as a form, section header rows with a label left and status right, and the
motion timings above.

Keep from Locus: the navy ink and teal "Included" state colour (colour still
means a file's state), the aperture file field as the one illustration, the
domain language, recorded and verifiable evidence.

Do better: a real dark theme across marketing and the app, readable label sizes,
a server-rendered hero, a consistent loaded serif, and no idle loops.

## Screenshots

Captured on the live site during this study at 1440x900 (hero, feature row,
split panel, ticket, footer, docs) and 375x812 (hero, feature rows). They are
kept with the session notes, not committed here, because they are another
product's pages.
