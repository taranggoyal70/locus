# Locus Guard pilot

Locus Guard is a task-derived Agent PR Firewall. The v0.3 pilot makes one
promise: **a required check can reject an exact Git candidate that changes a
path outside a separately trusted Slice.** It does not yet claim to prevent
reads outside that Slice.

## 1. Create the task contract before the agent branch

Start from the exact base commit the agent will receive:

```bash
node bin/locus.mjs guard init "fix duplicate invoice retries" \
  --task-id BILL-142 \
  --actor platform@example.com
```

If Locus cannot find a confident Anchor, it refuses to turn a whole-Repo Widen
into an allowlist. Refine the task with a filename, symbol, error, or evidence.
`--allow-whole-repo` exists for an explicit diagnostic decision, but provides no
scope reduction.

The command writes `.locus/scope.json` and prints a manifest hash. Retain that
hash somewhere the coding agent cannot change, such as a protected environment
variable, an organization variable writable only by the platform team, or a
Locus service record. Do not accept a hash calculated inside the candidate
branch as trusted input.

The generated manifest is a local control artifact. Keep `.locus/` untracked or
download the manifest into it during CI.

## 2. Record a scope decision

When the agent needs another path, a reviewer records the decision:

```bash
node bin/locus.mjs guard widen src/lib/idempotency.ts \
  --reason "the failing stack enters the shared retry adapter" \
  --actor reviewer@example.com
```

Use `--deny` to retain a rejected request in the Widen chain. Sensitive patterns
(`.env*`, private keys, and workflow files by default) require the additional
`--allow-sensitive` decision. After any approved or denied Widen, replace the
trusted manifest hash with the newly printed hash through the same trusted
control plane.

## 3. Verify the exact candidate

Fetch full Git history and run:

```bash
node bin/locus.mjs guard verify \
  --expected-manifest-hash "$LOCUS_GUARD_MANIFEST_HASH"
```

Guard verifies that:

- the manifest and every Widen event match their hashes;
- the expected hash from the trusted channel matches the manifest;
- the manifest repository matches the checkout;
- the frozen base is an ancestor of the candidate;
- the working tree is clean;
- the binary diff hashes to the receipt's candidate hash; and
- every changed or renamed path is admitted.

It writes `.locus/receipt.json` on both pass and policy failure, then exits
non-zero on failure. Invalid/tampered input fails before a receipt is issued.

For local exploration only, `--advisory` removes the external-hash requirement.
Its receipt is labeled `mode: advisory` and `trust: self-asserted`; do not make
that result a required merge check.

## 4. Install the GitHub merge gate

Use the composite action from an immutable Locus commit SHA, not a moving
branch. The manifest must already have been downloaded into the checkout, and
the checkout must use full history so the frozen base is available.

```yaml
name: Locus Guard
on:
  pull_request:

permissions:
  contents: read

jobs:
  locus-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<PINNED_SHA>
        with:
          fetch-depth: 0
          persist-credentials: false

      # Retrieve .locus/scope.json from the trusted Locus service/artifact here.

      - uses: taranggoyal70/locus/.github/actions/locus-guard@<LOCUS_COMMIT_SHA>
        with:
          manifest-hash: ${{ vars.LOCUS_GUARD_MANIFEST_HASH }}
```

Make `locus-guard` a required branch check. The expected manifest hash must not
come from a PR-controlled file, workflow output, or environment value the agent
can edit.

## 5. Attest and retain the receipt

Upload `.locus/receipt.json` even when the check fails. On a passing candidate,
use GitHub artifact attestations or Sigstore to attest that exact receipt file.
The receipt deliberately says `unsigned` until that external signing step has
completed.

The receipt binds the task, base SHA, candidate SHA, candidate diff hash,
manifest hash, admitted paths, Widen hashes, violations, verifier version, and
decision. It does not yet bind separate test commands or a human Review; those
are the next pilot milestone.

## Pilot limitations

- The v0.3 gate governs changed Git paths, not agent read access or shell tools.
- Its localization supports the same languages and graph limitations as the
  source CLI.
- A trusted hash store and manifest delivery path are operator responsibilities
  in this release.
- Tests/builds and human Review remain separate evidence. A green Guard receipt
  means “candidate stayed inside approved scope,” not “task succeeded.”
