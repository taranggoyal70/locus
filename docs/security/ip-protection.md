# Locus intellectual-property handling policy

**Owner:** Tarang Goyal<br>
**Classification:** Public<br>
**Effective:** November 21, 2026, replacing the version of September 15, 2026

This policy records how Locus protects its intellectual property while its
source code is public. It supplements the repository `LICENSE`; it is not a
replacement for signed intellectual-property assignment agreements or advice
from qualified counsel.

## Repository status

The repository is public on GitHub, and on November 21, 2026 the owner decided
to keep it public. Locus is source-available, not open source: anyone can read
the code, but `LICENSE` reserves all rights, and reading the code grants no right
to use, copy, modify, or distribute it.

The September 15, 2026 version of this policy described a private repository
with a confidential core. Everything committed to this repository, at any point
in its history, is publicly disclosed. That includes the Localize ranking,
scoring, Closure construction, Widen logic, and tuning; Agent orchestration,
prompts, provider policy, containment, and Guard internals; and the benchmark
corpus and results in `benchmarks/`. None of it may be represented as a trade
secret. Copyright and the terms of `LICENSE` still apply to all of it.

Material that must stay confidential has to be kept out of this repository from
the start. Once pushed, it is public, and deleting it later cannot recall a
clone, fork, archive, or screenshot.

## Information classes

### Public: everything in this repository

A push to any branch publishes its commits. Pull requests, review comments,
issues, release notes, and GitHub Actions logs are public too. Treat each of them
as published the moment it is created.

### Kept out of the repository

Keep these in private operational systems, never in commits, issues, pull
requests, or CI logs:

- Credentials and secrets (see below)
- Production configuration values, deployment settings, abuse-control settings
  that live outside the code, and incident records
- Customer source, Task Evidence, Run contents, usage records, and personal data
- Commercial plans, partner terms, pricing experiments, and the non-public roadmap
- New implementation work that is meant to stay proprietary. Develop it in a
  separate private repository; it cannot be made confidential after it is
  pushed here.

### Secrets

Credentials, signing keys, session material, encryption keys, access tokens,
webhook secrets, and production connection strings must never be committed.
Store them in the approved deployment provider or secret manager. If one enters
Git history, assume it was copied the moment it was pushed: revoke or rotate it
immediately. Deleting the file is not enough.

## Access rules

1. Grant write access to the repository, and access to production systems, only
   for a current, documented need.
2. Require multi-factor authentication on every account with that access.
3. Do not paste customer data, Run contents, credentials, or incident details
   into commits, issues, pull requests, CI logs, unapproved AI services, or
   shared chats.
4. Give a contractor or collaborator only the production access and data their
   task needs. Remove access promptly when the work ends.
5. Use encrypted devices. Do not store customer data or credentials on shared or
   unmanaged machines.
6. Review collaborators, deploy keys, GitHub Apps, webhooks, CI credentials, and
   deployment access at least once each quarter.
7. Report a suspected exposure of a secret or customer data immediately, and
   preserve the evidence.

## Contributor and ownership requirements

Before a founder, employee, contractor, or advisor receives write access or is
paid for work on Locus, the company should have a signed agreement covering
present assignment of relevant intellectual property, invention assignment,
confidentiality of the material kept out of the repository, and any excluded
background intellectual property. Payment for work alone is not treated as proof
that Locus owns the resulting code.

Do not accept an outside contribution, including a pull request from a public
fork, until its ownership and license are documented. Do not add code copied
from another project merely because it is visible online; verify its license
and preserve required notices.

## Before pushing

Every push is a publication. Before pushing a commit, opening a pull request, or
publishing a package, image, paper, or technical post:

1. Check that it contains no credentials, customer data, Run contents, personal
   data, commercial terms, or incident details, including in fixtures,
   screenshots, and logs.
2. Obtain patent review before pushing a potentially novel technical method.
   Pushing it publishes it, and publication may affect patent rights outside the
   United States.
3. Confirm ownership of every bundled dependency, asset, contribution, and data
   set, and preserve third-party notices.
4. For a package or image, assign a license written for that use and publish
   from a reviewed list of files.

The CLI package in `cli/` is marked private so it cannot be published by
accident, and the manual npm release workflow does not itself authorize
publication.

## Detection and response

CI scans the full Git history for credential patterns on every push to `main`
and every pull request against it. Synthetic credentials used to test Locus's
redaction behavior are suppressed by exact historical fingerprints so that new
findings still fail the scan.

For a suspected exposure of a secret or customer data:

1. Restrict or revoke the affected account and preserve access records.
2. Rotate any credentials that the exposed material could reveal.
3. Record what was exposed, where, and for how long.

For a suspected copy of Locus's code beyond what `LICENSE` allows:

1. Record the repository, commit, URLs, timestamps, screenshots, and a concise
   comparison without modifying the suspected evidence.
2. Ask qualified counsel to determine whether the issue is copyright
   infringement, breach of contract, trademark misuse, or lawful independent
   development.
3. Send a platform notice or takedown request only when the legal basis and
   copied material have been verified.

## Quarterly review record

Record each review in a private company system with the date, reviewer, access
changes, unresolved findings, and next review date. Do not place personal data or
credentials in this document.
