# Publishing locus-context

## Ownership and scope

The release operator owns this. Its scope is the `cli/` directory, published to
npm as `locus-context`, and the `Release locus-context` workflow.

The published package is a copy of `bin/`, mirrored by `pnpm sync-cli` and
verified by `pnpm check-sync`. It is not built, bundled, or transpiled: what is
in `cli/` is what runs on a user's machine.

## Before the first release

Two things must exist and neither is created by this repository:

- An npm account with publish rights to the unclaimed name `locus-context`.
  Verify the name is still free before promising it anywhere: `npm view
  locus-context` should 404.
- An `NPM_TOKEN` repository secret containing a granular access token scoped to
  publish this package and nothing else. A classic automation token works but
  grants more than this workflow needs.

Provenance requires the workflow's `id-token: write` permission, which is already
declared. It also requires the repository to be public, which it is. Provenance
attaches a signed statement linking the tarball to the commit and workflow run
that produced it, so a consumer can verify the package was built from this
source rather than uploaded from a laptop.

## Releasing

1. Bump the version in **both** `package.json` and `cli/package.json` in one
   commit. A test fails if they diverge, because the MCP server reads its version
   from whichever manifest sits beside it and a drift means the same build
   advertises two different versions.
2. Run `pnpm sync-cli` if `bin/` changed, then `pnpm check-sync`.
3. Merge to `main` and wait for CI to pass on that commit.
4. Run the `Release locus-context` workflow with `dry_run: true` and the version
   you are releasing. Read the `npm pack --dry-run` output and confirm the file
   list is what you expect: LICENSE, README.md, and the three `.mjs` files.
5. Run it again with `dry_run: false`.

The workflow refuses to publish a version that does not match `cli/package.json`,
and refuses to republish a version that already exists. It does not edit the
manifest: a release that rewrites its own inputs cannot be reproduced from the
commit it claims to come from.

## Verifying the release

```bash
npm view locus-context version
npx -y locus-context@<version> locate "fix the dashboard" --path .
```

Then verify the MCP server reports the version it was published as, from an
installed copy rather than a checkout:

```bash
npm install --no-save locus-context@<version>
node node_modules/locus-context/mcp.mjs   # banner must read v<version>
```

That last check is not ceremony. The server previously resolved its manifest one
directory up, which is correct from `bin/` in this repository and wrong from an
installed package, where one directory up is `node_modules`. It reported `0.1.0`
for every install, and no test that ran from a source checkout could have seen
it. `tests/cli-published-layout.test.mjs` now covers this, but confirming against
the real registry artifact costs one command.

## If a bad version is published

npm versions are immutable. `npm unpublish` is available only within 72 hours and
only when nothing depends on the package, and using it breaks anyone who already
installed.

Prefer publishing a fixed patch version and deprecating the bad one:

```bash
npm deprecate locus-context@<bad-version> "Reports an incorrect version; use <fixed-version>."
```

Deprecation leaves working installs alone and warns everyone else, which is the
right trade for a defect that is not a security issue. Reserve `unpublish` for a
package that leaked a credential, and rotate the credential first regardless.

## What this does not cover

- The web application, which deploys through Vercel independently of this
  package.
- Any change to `CAPABILITY_RELEASE` or Admission. Publishing the CLI grants
  nobody access to the hosted product.
