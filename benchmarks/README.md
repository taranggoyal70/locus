# Locus historical-task benchmark

Generated 2026-08-13T05:55:58.928Z. Locus was run on the parent snapshot of 15 real fixes across 3 repositories. The expected set is the TypeScript source files modified by the historical fix.

| Repository | Fix | Fix files found | Context reduction | Widened |
|---|---:|---:|---:|---:|
| locus | `b8d7634` | 1/1 | 3% | no |
| locus | `3b1d6c2` | 1/1 | 3% | no |
| locus | `bbdd822` | 2/2 | 0% | yes |
| locus | `2ff9895` | 1/1 | 48% | no |
| locus | `b92d859` | 1/1 | 53% | no |
| locus | `0831be0` | 1/1 | 36% | no |
| agent-access | `50a3e9e` | 1/1 | 0% | yes |
| agent-access | `071a85f` | 1/1 | 99% | no |
| agent-access | `fefa329` | 1/1 | 53% | no |
| Solum | `ce097b6` | 1/1 | 75% | no |
| Solum | `1497f31` | 2/2 | 56% | no |
| Solum | `425bb89` | 2/2 | 85% | no |
| Solum | `6a4a3aa` | 2/2 | 60% | no |
| Solum | `e9d4346` | 4/4 | 90% | no |
| Solum | `5c82dff` | 1/1 | 78% | no |

## Launch gate

- Fix-file recall: **100%** (15/15 cases with full recall)
- Median estimated context reduction: **53%**
- Conservative full-repo fallbacks: **2**
- Gate: **PASS**

## What this does—and does not—show

This replay measures whether Locus includes the files humans actually changed next, while estimating how much TypeScript context it excludes. It does **not** prove that an autonomous agent completed the task, that the excluded files were unnecessary, or that quality cannot regress. Token estimates use the existing character-based heuristic. Agent completion rate is a beta-study outcome, not a benchmark claim.

Cases are declared in [`benchmarks/cases.json`](./cases.json); run `pnpm benchmark` to reproduce them.
