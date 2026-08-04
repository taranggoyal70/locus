# Release 1 paired total-token evaluation

`contract.json` freezes 20 historical engineering tasks across five public repositories. Each task must run twice from the same immutable snapshot, model, prompt, tools, limits, and rubric: once with the Locus Slice and once with whole-repository context.

Reviewers must be blind to the arm and record criterion-level acceptance. `totalTokens` is the provider-reported input plus output usage for the complete agent loop. Failed, missing, or human-rejected pairs count as token non-improvements. Critical security, data-loss, or correctness regressions fail the gate.

Every result must bind itself to the frozen study with `contractVersion`, `snapshotSha`, `modelId`, `promptVersion`, and `toolsVersion`. It must also reference the immutable production evidence using the Run UUID, Review UUID, and 64-character proposal hash. Reused evidence IDs, unknown cases, mismatched snapshots, or different model/tool/prompt versions make the evidence incomplete.

Populate `results.json` with one `slice` and one `whole_repo` record per case, then run:

```sh
pnpm eval:release1
```

After changing checked-in results, regenerate the privacy-safe aggregate used by
the public evidence page, then verify that it is current:

```sh
pnpm evidence:release1:write
pnpm evidence:release1
```

`public-report.json` intentionally excludes Run UUIDs, Review UUIDs, and proposal
hashes. Those remain in `results.json` for auditability. Aggregate outcome metrics
stay `null` until every result is valid, unique, and paired; CI rejects a stale
public report.

The gate requires at least 80% human acceptance in both arms, no more than a five-point acceptance gap, at least 30% median paired total-token reduction, improvement in at least 15 of 20 pairs, complete evidence, and zero critical regressions. The checked-in empty results file intentionally fails closed until the study is run; it is not evidence.
