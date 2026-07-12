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

function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = input.trim().match(/github\.com[/:]([^/]+)\/([^/#?]+)/) ||
    input.trim().match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, "") };
}

/** Longest common directory prefix — used as the source root. */
function commonRoot(paths: string[]): string {
  if (!paths.length) return "";
  const split = paths.map((p) => p.split("/").slice(0, -1));
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
      return NextResponse.json({ error: "Enter a GitHub repo like owner/name or a full URL." }, { status: 400 });
    }
    const { owner, repo } = parsed;

    const info = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
    if (info.status === 404) return NextResponse.json({ error: "Repo not found or is private." }, { status: 404 });
    if (!info.ok) return NextResponse.json({ error: `GitHub error (${info.status}). Try again later.` }, { status: 502 });
    const meta = await info.json();
    const branch = meta.default_branch || "main";

    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      { headers: ghHeaders() },
    );
    if (!treeRes.ok) return NextResponse.json({ error: "Could not read the repo file tree." }, { status: 502 });
    const tree = await treeRes.json();

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
          const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
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
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5&sha=${branch}`,
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
      name: `${owner}/${repo}`,
      slug: `${owner}-${repo}`,
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
