# Security policy

## Supported surface

Security fixes are applied to the current `main` branch and the production deployment linked from the repository README. The hosted alpha accepts public repositories only. Private source, credentials, secrets, personal data, and confidential task evidence are outside the supported boundary.

## Report privately

Do not disclose a suspected vulnerability in a public issue. Open a [private GitHub Security Advisory](https://github.com/taranggoyal70/locus/security/advisories/new) with the affected route or component, impact, minimal reproduction, and suggested containment. Do not include real credentials or third-party personal data.

Critical reports target an initial response within four hours; high-severity reports target one business day. These are alpha response targets, not guarantees.

## Immediate containment

If active exploitation is suspected, the operator will disable Agent Run admission, preserve redacted logs and Run identifiers, revoke affected credentials, and roll the application back or fix forward. Public-write hardening, RLS, and evidence immutability are security boundaries and will not be weakened as a rollback shortcut.
