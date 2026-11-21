# Locus intellectual-property handling policy

**Owner:** Tarang Goyal<br>
**Classification:** Confidential — authorized access only<br>
**Effective:** September 15, 2026

This policy records how Locus protects non-public implementation details and
commercially valuable know-how. It supplements the repository `LICENSE`; it is
not a replacement for signed confidentiality and intellectual-property
assignment agreements or advice from qualified counsel.

## Repository status and prior exposure

The production repository is private. Only collaborators who need the source to
build, operate, secure, or review Locus may be granted access.

The repository was publicly accessible before September 15, 2026. Changing its
visibility prevents future public access through GitHub, but it cannot recall a
clone, archive, or screenshot made while it was public. Material that was
publicly disclosed must not be represented as a trade secret without legal
review. New and undisclosed implementation details can still be protected when
they are handled confidentially from creation.

## Information classes

### Confidential core

Keep these assets in private repositories and private operational systems:

- Localize ranking, scoring, Closure construction, Widen logic, and tuning
- Agent orchestration, prompts, provider policy, containment, and Guard internals
- The complete benchmark corpus, unpublished results, adversarial cases, and
  evaluation-generation process
- Abuse controls, rate-limit strategy, provider credentials, deployment
  configuration, incident records, and non-public architecture
- Customer source, Task Evidence, Run contents, usage records, and personal data
- Commercial plans, partner terms, pricing experiments, and the non-public roadmap

### Approved public material

Only deliberately reviewed artifacts may be public. Examples include the
marketing site, product documentation, selected benchmark methodology and
results, API schemas, a minimal SDK, and demonstration Repos. A public artifact
must not contain the private implementation needed to reproduce the hosted
service.

### Secrets

Credentials, signing keys, session material, encryption keys, access tokens,
webhook secrets, and production connection strings must never be committed.
Store them in the approved deployment provider or secret manager. If one enters
Git history, revoke or rotate it immediately; deleting the file is not enough.

## Access rules

1. Grant repository and production access only for a current, documented need.
2. Require multi-factor authentication on every account with access.
3. Do not fork, mirror, export, or paste confidential source into personal
   repositories, public issue trackers, unapproved AI services, or shared chats.
4. Share the minimum code and data required for a contractor or collaborator's
   task. Remove access promptly when the work ends.
5. Use encrypted devices and private networks. Do not store production source or
   customer data on shared or unmanaged machines.
6. Review collaborators, deploy keys, GitHub Apps, webhooks, CI credentials, and
   deployment access at least once each quarter.
7. Report suspected disclosure immediately. Preserve evidence and do not contact
   a suspected copier before legal review.

## Contributor and ownership requirements

Before a founder, employee, contractor, advisor, or outside contributor receives
confidential source access, the company should have a signed agreement covering
confidentiality, present assignment of relevant intellectual property, invention
assignment, and any excluded background intellectual property. Payment for work
alone is not treated as proof that Locus owns the resulting code.

Do not accept an external contribution until its ownership and license are
documented. Do not add code copied from another project merely because it is
visible online; verify its license and preserve required notices.

## Public-release gate

Before publishing any Locus repository, package, image, model artifact, paper, or
technical post:

1. Create a release artifact from an allowlisted set of files. Do not publish
   directly from the private core repository.
2. Review the artifact for implementation details that reproduce the confidential
   core, unpublished benchmark data, internal comments, customer data, and
   infrastructure information.
3. Run the full-history secret scan and inspect the packaged artifact separately.
4. Assign an explicit license written for the intended public use. Absence of a
   license is not a release strategy.
5. Confirm ownership of every bundled dependency, asset, contribution, and data
   set and preserve third-party notices.
6. Obtain patent review before publishing a potentially novel technical method.
   Publication may affect rights outside the United States.
7. Record the approved commit, exact file list, reviewer, date, and destination.

The manual npm release workflow does not itself authorize publication. A public
CLI or SDK should contain only the client contract needed to call the hosted
service; the hosted implementation remains private.

## Detection and response

CI scans Git history for credential patterns on every push and pull request.
Synthetic credentials used to test Locus's redaction behavior are suppressed by
exact historical fingerprints so that new findings still fail the scan.

For suspected source disclosure:

1. Restrict or revoke the affected account and preserve access records.
2. Rotate any credentials that the disclosed material could expose.
3. Record the repository, commit, URLs, timestamps, screenshots, and a concise
   comparison without modifying the suspected evidence.
4. Ask qualified counsel to determine whether the issue is copyright
   infringement, breach of contract, trade-secret misappropriation, trademark
   misuse, or lawful independent development.
5. Send a platform notice or takedown request only when the legal basis and copied
   material have been verified.

## Quarterly review record

Record each review in a private company system with the date, reviewer, access
changes, unresolved findings, and next review date. Do not place personal data or
credentials in this document.
