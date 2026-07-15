"use client";

import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { TokenMeter } from "@/components/TokenMeter";
import { useLocus } from "@/hooks/useLocus";
import benchmark from "../../benchmarks/results.json";

export default function Home() {
  const {
    repo, graph, result, task, selected, ghUrl, loading, error, note,
    examples: bundledExamples, bundled: BUNDLED,
    setTask, setSelected, setGhUrl, pickBundled, loadGithub,
  } = useLocus();
  const analyzeGithub = loadGithub;

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2 font-semibold text-paper">
            <span className="grid size-6 place-items-center rounded bg-accent/15 font-mono text-accent">⊙</span>
            Locus
          </div>
          <a
            href="https://github.com/taranggoyal70/locus"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper transition hover:border-accent hover:text-accent"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-muted-light">
          <span className="size-1.5 rounded-full bg-accent" /> Context localization for AI coding agents
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] text-paper sm:text-5xl">
          Show your AI agent <span className="text-accent">only the code it needs.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-light">
          Every edit doesn&apos;t need the whole repo. Type a task and watch the irrelevant
          code fade out — Locus maps it to a focused dependency slice. When the evidence is
          weak, it conservatively falls back to the whole repo.
        </p>
      </section>

      {/* controls */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-line-strong bg-surface/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">Repo</span>
            {BUNDLED.map((b) => (
              <button
                key={b.slug}
                onClick={() => pickBundled(b.slug)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  repo?.slug === b.slug ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-paper"
                }`}
              >
                {b.name}
              </button>
            ))}
            <span className="mx-1 text-line-strong">|</span>
            <input
              value={ghUrl}
              onChange={(e) => setGhUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeGithub()}
              placeholder="or paste a public GitHub repo — owner/name"
              className="min-w-[240px] flex-1 rounded-lg border border-line-strong bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={analyzeGithub}
              disabled={loading || !ghUrl.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load"}
            </button>
          </div>

          <div className="mt-4">
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe a task — e.g. “the dashboard chart is broken”"
              className="w-full rounded-lg border border-line-strong bg-ink px-4 py-3 text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {bundledExamples.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bundledExamples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setTask(ex)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-line-strong hover:text-paper"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(error || note) && (
            <p className={`mt-3 text-xs ${error ? "text-recent" : "text-muted"}`}>{error ?? note}</p>
          )}
        </div>
      </section>

      {/* main */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        {graph && result ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <DependencyGraph graph={graph} result={result} selected={selected} onSelect={setSelected} />
            <div className="space-y-5">
              <TokenMeter
                result={result}
                repo={repo}
                sparse={graph.edges.length / Math.max(1, graph.nodes.length) < 0.6}
              />
              <FilePanel result={result} repo={repo} selected={selected} onSelect={setSelected} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-16 text-center text-sm text-muted">
            {error ?? "Loading…"}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-accent" /> in scope (sent to agent)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded border border-excluded bg-[rgba(58,68,74,0.25)]" /> excluded from this context pack</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-recent" /> recently changed — likely relevant</span>
          <span className="flex items-center gap-1.5"><span className="text-accent">◎</span> anchor (the entry point)</span>
        </div>
      </section>

      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Measured, not promised</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-semibold text-paper">
            Replayed against fixes from real repositories
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { value: `${Math.round(benchmark.summary.fixFileRecall * 100)}%`, label: "historical fix-file recall" },
              { value: `${benchmark.summary.medianContextReductionPct}%`, label: "median estimated context reduction" },
              { value: `${benchmark.summary.cases} / ${benchmark.summary.repositories}`, label: "tasks / repositories" },
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-line bg-ink/40 p-5">
                <p className="font-mono text-3xl font-semibold text-accent">{metric.value}</p>
                <p className="mt-1 text-sm text-muted">{metric.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-muted">
            Historical replay checks whether the context includes files developers changed next.
            It does not measure autonomous agent completion or guarantee that excluded files are unnecessary.{" "}
            <a
              href="https://github.com/taranggoyal70/locus/tree/main/benchmarks"
              className="text-accent hover:underline"
            >
              Read the method and reproduce it →
            </a>
          </p>
        </div>
      </section>

      {/* how it works */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              { t: "1 · Map the graph", d: "Parse imports into a deterministic dependency graph — routes → components → hooks → libs. No LLM guessing." },
              { t: "2 · Localize the task", d: "Match task language against paths and source, then include dependencies and nearby integration points." },
              { t: "3 · Widen when uncertain", d: "If no file matches with enough evidence, fall back to the whole repo instead of returning a speculative small slice." },
            ].map((s) => (
              <div key={s.t} className="rounded-xl border border-line bg-ink/40 p-5">
                <h3 className="font-mono text-sm font-semibold text-paper">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-muted">
            Cross-cutting bugs (a shared util that broke the dashboard) are caught two ways:
            the shared file is already in the dependency slice, and a recent-change signal floats
            it to the top — so precision doesn&apos;t mean missing the real cause.
          </p>
        </div>
      </section>

      {/* use it on your repo */}
      <section id="use" className="mx-auto max-w-6xl px-6 py-16">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">Use it for real</p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold text-paper">
          Two ways to actually save tokens — not just look at a graph
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-line bg-ink/40 p-5">
            <h3 className="text-sm font-semibold text-paper">1 · Now, in your browser</h3>
            <p className="mt-1 text-sm text-muted">
              Load a supported public TypeScript repo above, describe the task, and hit{" "}
              <span className="text-accent">Copy context</span> — you get the focused slice as a
              paste-ready block. Give that to ChatGPT / Claude / Cursor instead of your whole repo.
              Zero install.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-ink/40 p-5">
            <h3 className="text-sm font-semibold text-paper">2 · In your agent&apos;s loop (CLI + MCP)</h3>
            <p className="mt-1 text-sm text-muted">
              A zero-dependency CLI and MCP server run the same localizer on your local repo, so the
              agent pulls the slice <em>before</em> it reads.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-line-strong bg-ink p-3 font-mono text-[11px] text-muted-light">{`# one-off, paste-ready context
npx github:taranggoyal70/locus \\
  locate "fix the dashboard" --pack

# as an MCP tool (Codex / Claude Code / Cursor)
{ "mcpServers": {
    "locus": { "command": "node",
      "args": ["/path/to/locus/bin/mcp.mjs"] } } }`}</pre>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="font-mono text-accent">⊙</span> Locus — less context, measured honestly.
          </span>
          <a href="https://github.com/taranggoyal70/locus" className="hover:text-accent">Source · MIT</a>
        </div>
      </footer>
    </div>
  );
}
