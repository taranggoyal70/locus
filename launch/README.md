# Locus launch kit

This folder contains the founder-led LinkedIn launch package for the Locus open-source beta.

- `LINKEDIN_POST.md` — launch post and first comment
- `locus-linkedin-video/BRIEF.md` — locked video brief
- `locus-linkedin-video/STORYBOARD.md` — six-scene, 50-second storyboard
- `locus-linkedin-video/index.html` — assembled silent video composition
- `locus-linkedin-video/renders/video.mp4` — final 1080×1080 LinkedIn-ready render

## Preview the video

```bash
cd launch/locus-linkedin-video
npm run dev
```

The video is square (1080×1080), caption-led, and designed for a muted LinkedIn feed. It uses current product captures and the benchmark results committed in `benchmarks/results.json`.

The featured workflow is a reproducible historical replay from `taranggoyal70/Solum` at parent commit `6a4a3aa`. For the task “prevent duplicate signup profile writes,” Locus selected 8 of 57 TypeScript files, included `app/(auth)/signup/page.tsx`, and estimated an 89% context reduction. Commit `ce097b6` changed that exact file next.
