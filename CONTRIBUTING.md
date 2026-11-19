# Contributing to Locus

Locus is proprietary, source-available software. Reading the code, running it locally to evaluate it and
reporting problems are welcome. **Code contributions from outside the project need a signed agreement covering
ownership and licensing before they can be accepted**, so please open an issue to discuss a change before writing
it. Pull requests without that agreement will be closed unmerged.

## Report a problem

- **Security issues:** never in a public issue. Follow [SECURITY.md](SECURITY.md).
- **Bugs:** include the command or route, the repository and task you localized (public repositories only), what
  you expected, what happened, and the output of `node bin/locus.mjs --help | head -1` or the `revision` from
  `/api/health`. Remove credentials and private source first.
- **A wrong Slice:** the most useful report is a public repository at a commit, the task text, the file you
  expected, and the `--json` output. That is exactly the shape of a benchmark case.

## Set up

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local   # only needed for the web app
```

Node.js 22 and pnpm 11 are what CI uses. The CLI, MCP server and tests need no keys.

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test
pnpm check:merge-markers && pnpm check-sync && pnpm check:alpha-claims
pnpm evidence:release1 && pnpm readme:assets --check
```

CI runs the same commands, a production build, a dependency audit and a secret scan, and every one must pass.

## Conventions

- **Domain language.** Read [CONTEXT.md](CONTEXT.md) and the relevant [ADRs](docs/adr) before changing domain
  behaviour, and use its terms exactly: Repo, Slice, Anchor, Widen, Run, Tier.
- **Two localizers, one algorithm.** [`bin/core.mjs`](bin/core.mjs) is a dependency-free port of
  [`src/lib/localizer.ts`](src/lib/localizer.ts). Change the TypeScript first, mirror it, and keep
  `tests/localizer-parity.test.mjs` green. `pnpm sync-cli` copies `bin/` into `cli/`; `pnpm check-sync` fails on
  drift.
- **Tests first for behaviour.** A bug fix starts with a failing test that reproduces it. Comments explain why a
  rule exists, usually with the incident or measurement behind it.
- **No unsupported claims.** Public copy may only state what a test, benchmark or capability record supports.
  `scripts/check-alpha-claims.mjs` blocks known overclaims; new benchmark numbers must come from a committed run.
- **Benchmarks are measurements.** Never drop or edit a held-out case because Locus gets it wrong. Change the
  protocol only by adding a new version and saying so in the report.
- **Capabilities ship in code.** Widening access means editing `CAPABILITY_RELEASE` in
  [`src/lib/admission.ts`](src/lib/admission.ts) in its own reviewed commit.
- **Migrations are append-only.** Add a new numbered file under `supabase/migrations`, replay the chain locally
  with `supabase db reset`, and run `LOCUS_LIVE_DB=1 pnpm test admission-live`.
- **Secrets never enter Git.** Use `.env.local` and the deployment's secret store. If a secret is committed,
  rotate it; deleting the file is not enough.
- **Commits** use the conventional style already in the history (`fix(billing): ...`, `feat(guard): ...`) and
  describe why, not only what.
