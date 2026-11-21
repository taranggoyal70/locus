# Locus held-out localization benchmark

Generated 2026-11-19T23:29:34.933Z from [`protocol.json`](./protocol.json) (heldout-v1, frozen 2026-11-19).

Locus was run on the parent snapshot of 60 bug fixes from 6 third-party
TypeScript repositories that it was never developed or tuned against. The cases were not chosen by hand: the
protocol takes the 10 most recent first-parent commits per repository whose
subject starts with "fix" and that modify 1 to 3 non-test source files, and every one of them is scored here,
misses included. The task text is the commit subject, mechanically cleaned.

## Results

| Measure | All cases | Localized cases | All cases, scope removed | Localized, scope removed |
|---|---:|---:|---:|---:|
| Cases | 60 | 57 | 60 | 54 |
| Fix-file recall | 100.0% | 100.0% | 94.4% | 93.7% |
| Cases with every fix file in the Slice | 60/60 | 57/57 | 57/60 | 51/54 |
| Widened to the whole repository | 3 | | 6 | |
| Median estimated context reduction | 71.5% | 72% | 70.5% | 71.5% |
| Recall of a random Slice of the same size | | 27.3% | | 28.2% |

- **Widened** cases are the conservative fallback: no file matched with enough confidence, so Locus returned
  the whole repository. They score full recall by definition and save nothing.
- **Localized** cases are the ones where Locus committed to a smaller Slice. Their recall is the honest
  measure of the ranking; the random-Slice row is what picking the same number of files blindly would recall,
  pooled over fix files the same way.
- **Scope removed** is an ablation added after the first run to test it. Conventional-commit scopes often name
  the fixed module (`devtools`, `jsx dom`), which hands the localizer a path match, so the same cases are
  rerun with the scope deleted from the task. The primary protocol was not changed.
- Median Slice size on localized cases: 102,159 estimated tokens,
  against a median repository of 419,031.

## Every case

| Repository | Fix | Task | Fix files in Slice | Context reduction | Scope removed |
|---|---|---|---:|---:|---:|
| honojs/hono | `75ff8e3` | utils types keep JSONParsed cheap for non-recursive types | 1/1 | 74% | 1/1 |
| honojs/hono | `a8ae5b1` | helper websocket do not depend on DOM-only types | 1/1 | 87% | 1/1 |
| honojs/hono | `fd7a330` | cookie do not accept a lone double quote as a cookie value | 1/1 | 60% | 1/1 |
| honojs/hono | `95431d1` | compress send the compressed response headers for HEAD requests | 1/1 | 86% | 1/1 |
| honojs/hono | `a46d602` | client keep class instances in the init options as they are | 1/1 | 65% | 1/1 |
| honojs/hono | `ab74a8d` | utils types stop JSONParsed at a recursive JSON type | 1/1 | 62% | 1/1 |
| honojs/hono | `399e7c9` | lambda edge omit body in a 204 result | 2/2 | 85% | 0/2 |
| honojs/hono | `dea44c8` | jsx dom keep a falsy Suspense fallback | 1/1 | 85% | 1/1 |
| honojs/hono | `265f36b` | combine continue the chain when a Condition returns true in every() | 1/1 | 53% | 1/1 |
| honojs/hono | `6dc11ed` | jsx dom restore attributes and effects when Suspense children suspend again | 1/1 | 85% | 1/1 |
| pmndrs/zustand | `bf6e60a` | devtools action dispatching | 1/1 | 72% | 1/1 |
| pmndrs/zustand | `e33b194` | middleware persist migration supporting promise-like | 1/1 | 77% | 1/1 |
| pmndrs/zustand | `da2706c` | persist preserve external devtools action arguments | 1/1 | 54% | 0/1 |
| pmndrs/zustand | `a1fea2e` | devtools preserve shared connections during store cleanup | 1/1 | 72% | 1/1 |
| pmndrs/zustand | `d867e6f` | devtools apply serialize.reviver when parsing devtools messages | 1/1 | 72% | 1/1 |
| pmndrs/zustand | `3febf8c` | persist clearStorage() should invalidate concurrent async rehydration | 1/1 | 77% | 1/1 |
| pmndrs/zustand | `f44cecc` | devtools correct V8 stack regex when source path contains spaces | 1/1 | 72% | 1/1 (widened) |
| pmndrs/zustand | `ad77bd3` | devtools improve type inference for Devtools initializer | 1/1 | 72% | 1/1 |
| pmndrs/zustand | `4e9bcf0` | devtools support Firefox/Safari stack format in findCallerName | 1/1 | 73% | 1/1 |
| pmndrs/zustand | `89ebcd7` | devtools correct redux devtools config type extension | 1/1 | 49% | 1/1 |
| pmndrs/jotai | `9f4992c` | internals do not prune dependencies when a superseded promise settles | 1/1 | 77% | 1/1 |
| pmndrs/jotai | `c4e3bc3` | internals unmount the last dependency when it is removed | 1/1 | 79% | 1/1 |
| pmndrs/jotai | `eb81bc4` | utils handle circular references and typed arrays in freezeAtom | 1/1 | 62% | 1/1 |
| pmndrs/jotai | `85aa951` | #3371 | 1/1 | widened | 1/1 (widened) |
| pmndrs/jotai | `0c23f15` | vanilla export store type | 2/2 | 54% | 2/2 |
| pmndrs/jotai | `5f5c844` | unwrap prevent infinite microtask loop on rejected source recompute | 1/1 | 79% | 1/1 (widened) |
| pmndrs/jotai | `bc273fd` | vanilla subscriber not notified after nested store.set and sub/unsub inside a write | 1/1 | 72% | 1/1 |
| pmndrs/jotai | `32708c8` | internals throw stackoverflow errors synchronously | 1/1 | 80% | 1/1 (widened) |
| pmndrs/jotai | `563f059` | vanilla utils atomWithStorage apply reviver when parsing subscription updates | 1/1 | 61% | 0/1 |
| pmndrs/jotai | `26f3e9c` | internals guard atomOnInit hook with hasOnInit | 1/1 | 70% | 1/1 |
| h3js/h3 | `2f29b87` | static join `indexNames` on a single `/` while keeping extension fallbacks | 1/1 | 51% | 1/1 |
| h3js/h3 | `3a7ed0e` | response absorb rejected `iterator.return()` when `iterable` is cancelled | 1/1 | 71% | 1/1 |
| h3js/h3 | `d252549` | response keep `iterable` streaming past skipped values | 1/1 | 68% | 1/1 |
| h3js/h3 | `060121a` | cache honor request methods when evaluating cache headers | 2/2 | 60% | 2/2 |
| h3js/h3 | `ccd127b` | response skip prepared headers merge for 101 upgrade responses | 1/1 | 62% | 1/1 |
| h3js/h3 | `fb2a994` | proxy preserve content-length for unencoded responses | 2/2 | 73% | 2/2 |
| h3js/h3 | `e379a32` | query reject malformed Content-Type tokens | 1/1 | 70% | 1/1 |
| h3js/h3 | `f90f4c8` | rules let `HTTPError.headers` opt out of `headers` rule on errors | 1/1 | 47% | 1/1 |
| h3js/h3 | `1326e74` | keep middleware-staged headers out of handler-level caches | 3/3 | 48% | 3/3 |
| h3js/h3 | `d658815` | rules keep middleware-staged headers out of `cache` entries | 1/1 | 50% | 1/1 |
| sindresorhus/ky | `d9ddb03` | CI | 1/1 | widened | 1/1 (widened) |
| sindresorhus/ky | `d4ce7b1` | docs | 3/3 | widened | 3/3 (widened) |
| sindresorhus/ky | `481f6f7` | bytes shortcut return type for Blob and Response compatibility | 1/1 | 54% | 1/1 |
| sindresorhus/ky | `8cf26e0` | stale array entries when merging JSON objects | 1/1 | 18% | 1/1 |
| sindresorhus/ky | `8546080` | UTF-8 decoding of JSON error responses | 1/1 | 46% | 1/1 |
| sindresorhus/ky | `6520f64` | retry abort propagation and uploads without request stream support | 1/1 | 30% | 1/1 |
| sindresorhus/ky | `88e2432` | `init` hook mutations to nested `json` and `context` values leaking across requests | 2/2 | 23% | 2/2 |
| sindresorhus/ky | `0e2501b` | `init` hooks receiving `undefined` for `headers` when no headers were provided | 1/1 | 49% | 1/1 |
| sindresorhus/ky | `91ea8a9` | a search parameter removed with `undefined` staying in the input URL when a later layer re-adds it | 2/2 | 34% | 2/2 |
| sindresorhus/ky | `7c1272b` | a user abort in Chromium being reported as `NetworkError` and retried | 1/1 | 38% | 1/1 |
| trpc/trpc | `ec55fef` | openapi document template literal outputs as strings | 1/1 | 81% | 1/1 |
| trpc/trpc | `43f23d7` | client stop the lazy wsClient inactivity timer polling while requests are pending | 2/2 | 89% | 2/2 |
| trpc/trpc | `b847a53` | upgrade call the `createTRPCNext` config once per mount | 1/1 | 83% | 1/1 |
| trpc/trpc | `a670737` | server let mergeAsyncIterables release the last buffered value | 1/1 | 88% | 1/1 |
| trpc/trpc | `36dfdb2` | tanstack react query rethrow Next.js digest errors from loadHandles | 1/1 | 86% | 1/1 |
| trpc/trpc | `95f0b5c` | client release httpBatchStreamLink abort listeners when the response ends | 1/1 | 89% | 1/1 |
| trpc/trpc | `4a387e5` | server keep the first router's root options in mergeRouters | 1/1 | 90% | 1/1 |
| trpc/trpc | `c4e063d` | server stop the node-http request body hanging when the client disconnects | 1/1 | 93% | 1/1 |
| trpc/trpc | `2feb6c3` | server pass a Buffer req.body through as bytes in the node-http adapter | 1/1 | 93% | 1/1 |
| trpc/trpc | `722649b` | monorepo credit everyone who pushed to a pull request in release notes | 1/1 | 97% | 1/1 |

## What this does and does not show

It shows whether the files a maintainer changed to fix a bug are in the Slice Locus returns for a one-line
description of that bug, on code Locus has never seen. It does not show that an agent given the Slice would
have produced the fix, that the excluded files were unnecessary, or how answer quality changes; that needs
the paired agent study in [`../release1`](../release1/README.md). Commit subjects are terser than real task
descriptions and carry no error text, which makes localization harder than with `--evidence`. Token counts
are Locus's chars/4 estimate, not a model tokenizer.

Reproduce with `node scripts/benchmark-heldout.mjs`. Repositories are cloned once into
`${TMPDIR}/locus-benchmarks/heldout` (override with `LOCUS_BENCH_CACHE`).
