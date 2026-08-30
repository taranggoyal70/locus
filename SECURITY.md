# Security policy

## Supported surface

Security fixes are applied to the current `main` branch and the production deployment at [locus-five-iota.vercel.app](https://locus-five-iota.vercel.app/). The hosted early access accepts public repositories only. Private source, credentials, secrets, personal data, and confidential task evidence are outside the supported boundary.

## Reporting a vulnerability

Do not disclose a suspected vulnerability in a public issue. Open a [private GitHub Security Advisory](https://github.com/taranggoyal70/locus/security/advisories/new) with the affected route or component, impact, minimal reproduction, and suggested containment. Do not include real credentials or third-party personal data.

Critical reports target an initial response within four hours; high-severity reports target one business day. These are early-access response targets, not guarantees.

Please avoid destructive testing, accessing data that is not yours, degrading service availability, or using automated scans that generate significant traffic.

## Immediate containment

If active exploitation is suspected, the operator will disable Agent Run admission, preserve redacted logs and Run identifiers, revoke affected credentials, and roll the application back or fix forward. Public-write hardening, row-level security, and evidence immutability are security boundaries and will not be weakened as a rollback shortcut.
