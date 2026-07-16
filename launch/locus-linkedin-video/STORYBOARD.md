---
format: 1080x1080
message: "Locus turns a task and its supporting evidence into the code context an agent should read first, with the reasoning left visible."
arc: "Demo Loop — founder pain → attach real evidence → repository workflow → bounded result → honest invitation"
audience: "Developers who use coding agents; technical founders, recruiters, and YC reviewers"
mode: autonomous
audio: silent
music: none
---

## Video direction

- **Register:** a founder screen recording with thoughtful annotations, not a launch trailer.
- **Format:** 1080×1080 LinkedIn feed; all essential information sits inside the top 83% safe area.
- **Palette and type:** use the exact Locus tokens from `frame.md`; lime is a focus indicator, never decoration.
- **Motion grammar:** one cursor, one camera, ordinary pauses. Motion follows the task: type, click, inspect, copy. Smooth long-tail settling only.
- **Stillness allocation:** hold after the task is typed, after the result resolves, and on the final URL. These pauses should feel like a person checking their work.
- **Human timing:** cursor paths are slightly asymmetric; include short thinking pauses before Analyze and before inspecting the result. Do not make every beat equally spaced.
- **Copy:** sentence case, first person, and concrete nouns. No “revolutionary,” “supercharge,” “future of,” “AI-native,” or anonymous marketing voice.
- **Subtitles:** conversational first-person commentary, written like the founder is sitting beside the viewer. Keep each card to one short thought, use contractions, and time the language to the action rather than restating headings.
- **Negative list:** no kinetic word slams, no floating glass cards, no count-up spectacle, no fake browser chrome, no purple/blue gradients, no bouncy easing, no breathing loops, no connector diagrams as decoration, no front-load-then-freeze behavior.
- **Asset discipline:** every visible product surface comes from the captured live Locus page; reconstructed interaction overlays must align to controls visible in that capture.
- **Claim discipline:** this is one historical Solum replay. Token figures stay labeled “estimated,” and fix-file recall is not described as autonomous task success.

## Frame 1 — Why I built it

- status: animated
- src: compositions/frames/01-founder-note.html
- duration: 4s
- poster: 2.8s
- transition_in: cut
- scene: A quiet first-person founder note over the real product, written as a normal sentence rather than a slogan.
- onscreen: "I kept running out of context halfway through coding tasks."
- type: hook
- blueprint: typewriter-reveal (Adapt)
- narrativeRole: Name the original frustration in the founder's own voice so the product feels motivated by a real problem.
- asset_candidates: capture/screenshots/scroll-000.png
- focal: capture/screenshots/scroll-000.png
- roles: scroll-000.png = real product background, softly dimmed while the founder note is typed
- sfx: none

Adapt: keep the blueprint's typed everyday thought. Remove the logo pop and promotional reveal; the sentence and real interface are enough.

Scene 1 (0.0–0.7s): the live Locus capture appears already open, flat and nearly full-frame; layered-depth layout with the interface as the only background plane. A small “why I built this” note appears at top left via a restrained per-word reveal (`dynamic-content-sequencing`).
Scene 2 (0.7–3.1s): “I kept running out of context halfway through coding tasks.” types onto a plain note strip with a caret (`discrete-text-sequence`, `context-sensitive-cursor`). The typing includes one brief pause after “context,” then continues.
Scene 3 (3.1–4.0s): the caret blinks twice and everything holds still. No logo sting and no exit animation.

Subtitle (0.35–4.0s): “Honestly, this started because I kept hitting the same wall.”

## Frame 2 — Attach what the prompt leaves out

- status: animated
- src: compositions/frames/02-task-evidence.html
- duration: 9s
- poster: 6.4s
- transition_in: crossfade
- scene: The real task area gains an attachment, extracts the actual signup failure text, and keeps the evidence inspectable.
- onscreen: "signup-bug-report.pdf · Account created but profile save failed · attachments are not saved"
- type: feature_showcase
- blueprint: cursor-ui-demo (Adapt)
- narrativeRole: Show that Locus can use the screenshot or document behind a vague task without turning into a generic document chatbot.
- asset_candidates: capture/screenshots/scroll-000.png
- focal: capture/screenshots/scroll-000.png
- roles: scroll-000.png = real Locus task surface behind the implemented attachment control and extracted-evidence state
- sfx: none

Adapt: keep one ordinary cursor and a single task surface. The attachment control, status, evidence card, privacy copy, and removal action must match the implemented `TaskEvidence` component; do not show a fake operating-system file picker.

Scene 1 (0.0–2.0s): the real task panel is framed at reading size. The task field contains “Fix this signup issue.” A small annotation reads “Sometimes the useful detail isn’t in the prompt.”
Scene 2 (2.0–4.0s): the cursor clicks “Attach screenshot or document.” The control changes to “Extracting document text…” and holds for a natural beat (`cursor-click-ripple`, `press-release-spring`).
Scene 3 (4.0–7.2s): an evidence row appears for `signup-bug-report.pdf`. It opens to the extracted sentence: “Account created but profile save failed. You can update your profile later.” A second line reads “Expected: one profile write after account creation.” (`dynamic-content-sequencing`, `viewport-change`).
Scene 4 (7.2–9.0s): the privacy line receives a quiet focus stroke: “Documents are processed in memory. Attachments are not saved.” Hold still long enough to read.

Subtitles: (0.4–4.2s) “Sometimes the useful context isn’t in the prompt. It’s in the bug report.” (4.3–9.0s) “So now I can attach it, inspect the text, and use that evidence too.”

## Frame 3 — One real repository task

- status: animated
- src: compositions/frames/02-real-workflow.html
- duration: 15s
- poster: 10.2s
- transition_in: crossfade
- scene: A cursor performs the actual Locus workflow on the captured product: repository, task, Analyze, then the evidence trail.
- onscreen: "Solum @ 6a4a3aa · Prevent duplicate signup profile writes · task matches → imports → nearby integration"
- type: feature_showcase
- blueprint: cursor-ui-demo (Adapt)
- narrativeRole: Prove the message through one understandable workflow before making any efficiency claim.
- asset_candidates: capture/screenshots/scroll-000.png; capture/screenshots/scroll-042.png
- focal: capture/screenshots/scroll-000.png
- roles: scroll-000.png = primary live workflow surface; scroll-042.png = real lower-page result state after analysis
- sfx: none

Adapt: keep the blueprint's cursor-led end-to-end workflow and camera chase. Use only controls and states visible in the captured Locus interface; do not invent menus, modals, or browser chrome.

Scene 1 (0.0–2.2s): the real Locus page fills the frame. A small caption reads “real task · Solum @ 6a4a3aa.” The cursor enters from the lower right, pauses over the task field, and the camera makes one small focus-lock toward that field (`camera-cursor-tracking`, `coordinate-target-zoom`).
Scene 2 (2.2–6.8s): “Prevent duplicate signup profile writes” types into the visible task field (`discrete-text-sequence`, `context-sensitive-cursor`). Typing is uneven in natural phrase groups, followed by a 0.6s thinking pause.
Scene 3 (6.8–8.4s): the cursor moves to Analyze and clicks once with a restrained press and ripple (`cursor-click-ripple`, `press-release-spring`). A small status line changes from “ready” to “reading repository evidence”; no spinner spectacle.
Scene 4 (8.4–12.8s): the product surface shifts to the captured analyzed state using a matched downward cut. The camera follows the cursor through “Task matches,” “Imported dependencies,” and “Nearby integration”; each label receives one quiet lime focus stroke when inspected (`viewport-change`, `asr-keyword-glow`).
Scene 5 (12.8–15.0s): the cursor stops above the ranked context panel. A plain annotation appears: “Locus shows why each file made the cut.” The camera settles completely still.

Subtitles: (0.6–4.6s) “Then I’ll use a real repository task from Solum.” (4.7–9.4s) “Locus follows what the task actually touches.” (9.5–15.0s) “And I can still see why every file made the cut.”

## Frame 4 — What came back

- status: animated
- src: compositions/frames/03-real-result.html
- duration: 10s
- poster: 7.2s
- transition_in: cut
- scene: The actual Solum replay result is inspected without turning the metrics into a spectacle.
- onscreen: "8 of 57 files selected · 49 left out · signup/page.tsx included · 89% fewer estimated tokens"
- type: benefit_highlight
- blueprint: video-text-pivot (Adapt)
- narrativeRole: Translate the workflow into a bounded result that a developer can evaluate without overstating what was proven.
- asset_candidates: capture/screenshots/scroll-042.png; capture/screenshots/scroll-085.png
- focal: capture/screenshots/scroll-042.png
- roles: scroll-042.png = real ranked context and token result; scroll-085.png = supporting historical benchmark evidence, used only as a small verification strip
- sfx: none

Adapt: keep the real-product-to-result handoff. Remove the frame-filling count-up and animated stat cards; the interface remains dominant and the figures read like annotations.

Scene 1 (0.0–3.0s): the analyzed Locus capture fills the canvas. The cursor highlights the selected/excluded summary and a small annotation types: “8 selected · 49 left out” (`camera-cursor-tracking`, `discrete-text-sequence`).
Scene 2 (3.0–6.6s): the cursor moves to `app/(auth)/signup/page.tsx`. A slim outline appears around the real row and a note reveals beside it: “This was the next file changed in the historical fix.” (`cursor-click-ripple`, `css-marker-patterns`).
Scene 3 (6.6–8.6s): the cursor shifts to the token meter. “89% fewer estimated tokens in this replay” appears at reading size; “estimated” remains on the same line. No count-up (`dynamic-content-sequencing`).
Scene 4 (8.6–10.0s): a small footnote appears: “Historical replay, not autonomous task success.” The screen holds still long enough to read.

Subtitles: (0.4–3.3s) “Here, it kept 8 files and left 49 out.” (3.4–7.0s) “The next file changed in the real fix was included.” (7.1–10.0s) “It’s a historical replay—not a claim that the agent solved it.”

## Frame 5 — Break it

- status: animated
- src: compositions/frames/04-human-cta.html
- duration: 7s
- poster: 4.8s
- transition_in: crossfade
- scene: A restrained founder invitation closes on the product URL and GitHub repository.
- onscreen: "I'm looking for 10 developers to try Locus on a real task and tell me where it breaks."
- type: cta
- blueprint: typewriter-reveal (Adapt)
- narrativeRole: Convert interest into honest design-partner feedback rather than a generic launch click.
- asset_candidates: capture/assets/favicon.svg; capture/screenshots/scroll-100.png
- focal: capture/assets/favicon.svg
- roles: favicon.svg = real Locus mark; scroll-100.png = quiet real-use background proof
- sfx: none

Adapt: keep the persistent mark and typed CTA rail. Remove the logo assembly, giant pill, and “founding design partner” pitch language.

Scene 1 (0.0–1.2s): the real-use capture sits dimmed behind a small fixed Locus mark and wordmark; no assembly animation. “Open-source beta” fades in beneath it.
Scene 2 (1.2–4.8s): “I'm looking for 10 developers to try Locus on a real task and tell me where it breaks.” types in two natural lines with a short pause after “real task” (`discrete-text-sequence`, `context-sensitive-cursor`).
Scene 3 (4.8–7.0s): the URL and GitHub path appear together via a quiet sequential reveal (`dynamic-content-sequencing`): `locus-five-iota.vercel.app` and `github.com/taranggoyal70/locus`. Hold still to the end.

Subtitles: (0.5–3.9s) “If you use coding agents every day, I’d love for you to try it.” (4.0–7.0s) “And honestly, tell me where it breaks.”

## Asset audit

| Asset | Type | Frames | Role |
|---|---|---|---|
| capture/assets/favicon.svg | Brand mark | 4 | Real product identity |
| capture/screenshots/scroll-000.png | Live product capture | 1, 2, 3 | Founder problem, attachment evidence, and task workflow |
| capture/screenshots/scroll-042.png | Live product capture | 3, 4 | Analyzed state, evidence trail, and ranked result |
| capture/screenshots/scroll-085.png | Live product capture | 4 | Small historical-proof strip only |
| capture/screenshots/scroll-100.png | Live product capture | 5 | Real-use background under the invitation |
