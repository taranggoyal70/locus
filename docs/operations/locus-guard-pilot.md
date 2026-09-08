# Locus Guard pilot

Locus Guard is a task-derived Agent PR Firewall. The v0.4 pilot makes two narrow
promises: **the supported local runner prevents its agent process from reading
or writing excluded paths in the target Repo, and the required merge check can
reject an exact Git candidate that changes a path outside a separately trusted
Slice.** Neither promise proves the task is correct.

## 1. Create the Guard scope manifest before the agent branch

Start from the exact base commit the agent will receive:

```bash
node bin/locus.mjs guard init "fix duplicate invoice retries" \
  --task-id BILL-142 \
  --actor platform@example.com
```

If Locus cannot find a confident Anchor, it refuses to turn a whole-Repo Widen
into an allowlist. Refine the task with a filename, symbol, error, or evidence.

The command writes `.locus/scope.json` and prints a manifest hash. Retain that
hash somewhere the coding agent cannot change, such as a protected environment
variable, an organization variable writable only by the platform team, or a
Locus service record. Do not accept a hash calculated inside the candidate
branch as trusted input.

The generated manifest is a local control artifact. Keep `.locus/` untracked or
download the manifest into it during CI.

## 2. Record a Guard Widen event

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

## 3. Run the agent inside the target-Repo boundary

Generate a signing key outside the Repo, then run the agent with one or more
trusted Check commands:

```bash
node bin/locus.mjs guard keygen \
  --private-key /secure/locus/guard-private.pem \
  --public-key .locus/guard-public.pem

node bin/locus.mjs guard run \
  --agent codex \
  --prompt "fix duplicate invoice retries" \
  --expected-manifest-hash "$LOCUS_GUARD_MANIFEST_HASH" \
  --signing-key /secure/locus/guard-private.pem \
  --check "pnpm test" \
  --check "pnpm typecheck"
```

Keep the private key in its own dedicated directory. Guard protects that
directory from the agent and Checks; do not place other runtime files there.

Use `--agent claude` for Claude Code. For another harness, use
`--agent command -- <executable> <args...>`. macOS uses Seatbelt; Linux requires
Bubblewrap. Missing containment fails closed. The boundary hides the original
target Repo and denies host writes outside the ephemeral runtime, but permits
the host network and does not claim to hide every other readable host file.

The command applies nothing if the agent exits non-zero, creates an unapproved
path, produces a symlink/special file, or returns an empty candidate. Each
declared Check runs against the exact candidate in a disposable detached
worktree. Ignored build artifacts disappear with that worktree, and the clean
candidate reaches the original Repo only after all Checks pass. The signed
receipt records exact content hashes, command exits and bounded output, and
provider-reported usage/cost when the provider emits it.

## 4. Bind a human Review

After inspecting the candidate, record one immutable Review:

```bash
node bin/locus.mjs guard review \
  --decision accepted \
  --actor reviewer@example.com \
  --criterion "Invoice retry is idempotent" \
  --public-key .locus/guard-public.pem \
  --signing-key /secure/locus/guard-private.pem
```

An accepted Review cannot be attached to a failing Run. A second decision is
refused; start a new Run instead. Verify the envelope offline with
`guard receipt verify --public-key .locus/guard-public.pem`.

## 5. Verify the exact Git candidate

Fetch full Git history and run:

```bash
node bin/locus.mjs guard verify \
  --expected-manifest-hash "$LOCUS_GUARD_MANIFEST_HASH" \
  --expected-candidate-sha "$GITHUB_HEAD_SHA"
```

Guard verifies that:

- the manifest and every Widen event match their hashes;
- the expected hash from the trusted channel matches the manifest;
- the manifest repository matches the checkout;
- the frozen base is an ancestor of the candidate;
- the checked-out candidate is the trusted pull-request head SHA;
- the working tree is clean;
- the binary diff hashes to the receipt's candidate hash; and
- every changed or renamed path is admitted.

It writes `.locus/receipt.json` on both pass and policy failure, then exits
non-zero on failure. Invalid/tampered input fails before a receipt is issued.

For local exploration only, `--advisory` removes the external-hash requirement.
Its receipt is labeled `mode: advisory` and `trust: self-asserted`; do not make
that result a required merge check.

## 6. Install the GitHub merge gate

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
          ref: ${{ github.event.pull_request.head.sha }}
          fetch-depth: 0
          persist-credentials: false

      # Retrieve .locus/scope.json from the trusted Locus service/artifact here.

      - uses: taranggoyal70/locus/.github/actions/locus-guard@<LOCUS_COMMIT_SHA>
        with:
          manifest-hash: ${{ vars.LOCUS_GUARD_MANIFEST_HASH }}
          candidate-sha: ${{ github.event.pull_request.head.sha }}
```

Make `locus-guard` a required branch check. The expected manifest hash must not
come from a PR-controlled file, workflow output, or environment value the agent
can edit.

## 7. Attest and retain the merge receipt

Upload `.locus/receipt.json` even when the check fails. On a passing candidate,
use GitHub artifact attestations or Sigstore to attest that exact receipt file.
The receipt deliberately says `unsigned` until that external signing step has
completed.

The receipt binds the task, base SHA, candidate SHA, candidate diff hash,
manifest hash, task-evidence digests, per-path inclusion reasons, admitted
paths, Widen hashes, violations, verifier version, and decision. The JSON and
receipt hash are deterministic for identical inputs; signing infrastructure may
add issuance time separately. The local Guard Run receipt separately binds
Checks, provider-reported usage, and human Review to the pre-commit candidate.

## Pilot limitations

- The v0.4 local runner contains access to the target Repo; it does not provide
  whole-host confidentiality, network isolation, or disposable-VM isolation.
- Check commands are trusted user input and run in a disposable candidate
  worktree after path enforcement. They can read the checked-out source and
  host-readable data; use disposable-machine isolation for hostile Checks.
- The local Review lock serializes one receipt file. Preventing decisions from
  copied pending receipts requires a shared append-only control plane.
- Its localization supports the same languages and graph limitations as the
  source CLI.
- A trusted hash store and manifest delivery path are operator responsibilities
  in this release.
- The local Repo lock is cooperative; run automation in a dedicated checkout so
  unrelated tools cannot race final candidate delivery.
- A green Guard Run plus an accepted Review means the recorded signer accepted
  that exact proposal; it still does not independently prove task success.
