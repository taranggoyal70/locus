import { NextResponse } from "next/server";

import type { RepoData } from "@/lib/types";

// Fetch a public GitHub repo's TypeScript source into the flat {path: content}
// shape the localizer uses. Tree comes from the API (1 call, GITHUB_TOKEN
// optional for higher limits); file contents come from raw.githubusercontent
// (not API-rate-limited). Capped so arbitrary repos stay responsive.
const MAX_FILES = 160;
const SRC_RE = /\.(ts|tsx)$/;
const IGNORE = /(^|\/)(node_modules|\.next|dist|build|\.git|vendor|tests?|__tests__|e2e)\//i;

function ghHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function parseRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const value = input.trim();
  const short = value.match(/^([\w.-]+)\/([\w.-]+?)(?:@([\w./-]+))?$/);
  if (short) {
    return {
      owner: short[1],
      repo: short[2].replace(/\.git$/, ""),
      ref: short[3],
    };
  }

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    const ref = parts[2] === "tree" && parts.length > 3 ? parts.slice(3).join("/") : undefined;
    if (![owner, repo].every((part) => /^[\w.-]+$/.test(part))) return null;
    if (ref && !/^[\w./-]+$/.test(ref)) return null;
    return { owner, repo, ref };
  } catch {
    return null;
  }
}

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Longest common directory prefix — used as the source root. Top-level loose
 * files (e.g. next.config.ts, middleware.ts) are EXCLUDED from the computation:
 * otherwise a single root-level file collapses a real `src/` root to "", which
 * makes buildGraph find zero Surfaces and silently widen every task. (Mirrors
 * the CLI's commonDirPrefix in bin/core.mjs — keep in sync.)
 */
function commonRoot(paths: string[]): string {
  const split = paths.map((p) => p.split("/").slice(0, -1)).filter((segs) => segs.length > 0);
  if (!split.length) return "";
  let prefix = split[0];
  for (const parts of split) {
    let i = 0;
    while (i < prefix.length && i < parts.length && prefix[i] === parts[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix.join("/");
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    const parsed = parseRepo(String(url ?? ""));
    if (!parsed) {
      return NextResponse.json({ error: "Enter owner/repo, owner/repo@commit, or a GitHub URL." }, { status: 400 });
    }
    const { owner, repo, ref } = parsed;

    const info = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
    if (info.status === 404) return NextResponse.json({ error: "Repo not found or is private." }, { status: 404 });
    if (!info.ok) return NextResponse.json({ error: `GitHub error (${info.status}). Try again later.` }, { status: 502 });
    const meta = await info.json();
    const revision = ref || meta.default_branch || "main";

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(revision)}?recursive=1`,
      { headers: ghHeaders() },
    );
    if (treeRes.status === 404) {
      return NextResponse.json({ error: `Commit or branch “${revision}” was not found.` }, { status: 404 });
    }
    if (!treeRes.ok) return NextResponse.json({ error: "Could not read the repo file tree." }, { status: 502 });
    const tree = await treeRes.json();
    const resolvedRevision = String(tree.sha || revision);

    let files = (tree.tree as { path: string; type: string; size?: number }[])
      .filter((n) => n.type === "blob" && SRC_RE.test(n.path) && !IGNORE.test(n.path) && (n.size ?? 0) < 200_000)
      .map((n) => n.path);
    if (files.length === 0) {
      return NextResponse.json({ error: "No TypeScript/TSX source found in that repo." }, { status: 400 });
    }
    const truncated = files.length > MAX_FILES;
    files = files.slice(0, MAX_FILES);

    const entries = await Promise.all(
      files.map(async (path) => {
        try {
          const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${resolvedRevision}/${rawPath(path)}`);
          if (!r.ok) return null;
          return [path, await r.text()] as const;
        } catch {
          return null;
        }
      }),
    );
    const fileMap: Record<string, string> = {};
    for (const e of entries) if (e) fileMap[e[0]] = e[1];

    // best-effort recent-change signal from the last few commits
    let recentlyChanged: string[] = [];
    try {
      const commits = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5&sha=${encodeURIComponent(resolvedRevision)}`,
        { headers: ghHeaders() },
      ).then((r) => (r.ok ? r.json() : []));
      const detail = await Promise.all(
        (commits as { sha: string }[]).slice(0, 5).map((c) =>
          fetch(`https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`, { headers: ghHeaders() })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      const changed = new Set<string>();
      for (const d of detail) {
        const fs = (d?.files ?? []) as { filename: string }[];
        // skip bulk commits — not a targeted-change signal
        if (fs.length && fs.length <= Math.max(2, Math.floor(0.4 * Object.keys(fileMap).length))) {
          for (const f of fs) if (SRC_RE.test(f.filename) && fileMap[f.filename] !== undefined) changed.add(f.filename);
        }
      }
      recentlyChanged = [...changed];
    } catch {
      recentlyChanged = [];
    }

    const repoData: RepoData = {
      name: `${owner}/${repo}${ref ? `@${resolvedRevision.slice(0, 7)}` : ""}`,
      slug: `${owner}-${repo}${ref ? `-${resolvedRevision.slice(0, 7)}` : ""}`,
      description: meta.description || `${owner}/${repo}`,
      root: commonRoot(Object.keys(fileMap)),
      recentlyChanged,
      files: fileMap,
    };
    return NextResponse.json({ repo: repoData, truncated, fileCount: Object.keys(fileMap).length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
