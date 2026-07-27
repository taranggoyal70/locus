# Locus historical-task benchmark

Generated 2026-07-27T10:16:29.744Z. Locus was run on the parent snapshot of 15 real fixes across 3 repositories. The expected set is the TypeScript source files modified by the historical fix. A safe Widen retains every loaded file, but it is not counted as a successful localization.

| Repository | Fix | Focused fix files found | Context reduction | Safe Widen |
|---|---:|---:|---:|---:|
| locus | `b8d7634` | 1/1 | 3% | no |
| locus | `3b1d6c2` | 1/1 | 3% | no |
| locus | `bbdd822` | not scored | 0% | yes |
| locus | `2ff9895` | 1/1 | 52% | no |
| locus | `b92d859` | 1/1 | 52% | no |
| locus | `0831be0` | 1/1 | 65% | no |
| agent-access | `50a3e9e` | not scored | 0% | yes |
| agent-access | `071a85f` | 1/1 | 99% | no |
| agent-access | `fefa329` | 1/1 | 75% | no |
| Solum | `ce097b6` | 1/1 | 75% | no |
| Solum | `1497f31` | 2/2 | 64% | no |
| Solum | `425bb89` | 2/2 | 83% | no |
| Solum | `6a4a3aa` | 2/2 | 71% | no |
| Solum | `e9d4346` | 4/4 | 90% | no |
| Solum | `5c82dff` | 1/1 | 78% | no |

## Launch gate

- Tasks localized without Widen: **87%** (13/15)
- Fix-file recall on localized tasks: **100%** (19/19 files; 13/13 cases with full recall)
- End-to-end focused fix-file coverage: **86%** (Widen fallbacks receive no localization credit)
- Median estimated context reduction: **65%**
- Conservative all-loaded-file fallbacks: **2**
- Gate: **PASS**

## What this does—and does not—show

This replay measures whether Locus includes the files humans actually changed next, while estimating how much TypeScript context it excludes. It does **not** prove that an autonomous agent completed the task, that the excluded files were unnecessary, or that quality cannot regress. Token estimates use the existing character-based heuristic. Agent completion rate is a beta-study outcome, not a benchmark claim.

Cases are declared in [`benchmarks/cases.json`](./cases.json); run `pnpm benchmark` to reproduce them.
