import { publicGitHubCoordinates } from "@/lib/agent/github-source";
import type { AgentChange } from "@/lib/agent/workspace";
import { validateRepoPath } from "@/lib/agent/workspace-tools";

type DeliveryInput = {
  token: string;
  repository: string;
  baseRef: string;
  runId: string;
  task: string;
  summary: string;
  changes: AgentChange[];
};

type GitHubFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function branchSlug(task: string): string {
  const words = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 2)
    .join("-");
  return words || "agent-change";
}

async function githubJson<T>(
  fetcher: GitHubFetcher,
  token: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetcher(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String(payload.message)
      : `GitHub request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export async function createGitHubPullRequest(
  input: DeliveryInput,
  fetcher: GitHubFetcher = fetch,
): Promise<{ branch: string; pullRequestNumber: number; url: string }> {
  if (!input.token) throw new Error("GitHub connection is required for delivery");
  if (input.changes.length === 0 || input.changes.length > 30) {
    throw new Error("Delivery change set must contain between 1 and 30 files");
  }

  const { owner, repo } = publicGitHubCoordinates(input.repository);
  const baseRef = input.baseRef.trim();
  if (!/^[A-Za-z0-9_./-]{1,200}$/.test(baseRef)) {
    throw new Error("Base branch contains unsupported characters");
  }
  const changes = input.changes.map((change) => ({
    path: validateRepoPath(change.path),
    content: change.content,
  }));
  const runSuffix = input.runId.replace(/[^a-f0-9]/gi, "").slice(0, 8).toLowerCase();
  const branch = `locus/${branchSlug(input.task)}-${runSuffix || "run"}`;
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const encodedBase = baseRef.split("/").map(encodeURIComponent).join("/");

  const baseReference = await githubJson<{ object: { sha: string } }>(
    fetcher,
    input.token,
    `${api}/git/ref/heads/${encodedBase}`,
  );
  const baseCommit = await githubJson<{ tree: { sha: string } }>(
    fetcher,
    input.token,
    `${api}/git/commits/${baseReference.object.sha}`,
  );

  const tree: Array<{
    path: string;
    mode: "100644";
    type: "blob";
    sha: string | null;
  }> = [];
  for (const change of changes) {
    if (change.content === null) {
      tree.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    if (change.content.length > 200_000) throw new Error(`${change.path} exceeds delivery limits`);
    const blob = await githubJson<{ sha: string }>(
      fetcher,
      input.token,
      `${api}/git/blobs`,
      {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(change.content, "utf8").toString("base64"),
          encoding: "base64",
        }),
      },
    );
    tree.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const nextTree = await githubJson<{ sha: string }>(
    fetcher,
    input.token,
    `${api}/git/trees`,
    {
      method: "POST",
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
    },
  );
  const commit = await githubJson<{ sha: string }>(
    fetcher,
    input.token,
    `${api}/git/commits`,
    {
      method: "POST",
      body: JSON.stringify({
        message: input.task.trim().slice(0, 72),
        tree: nextTree.sha,
        parents: [baseReference.object.sha],
      }),
    },
  );
  await githubJson(
    fetcher,
    input.token,
    `${api}/git/refs`,
    {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    },
  );
  const pullRequest = await githubJson<{ html_url: string; number: number }>(
    fetcher,
    input.token,
    `${api}/pulls`,
    {
      method: "POST",
      body: JSON.stringify({
        title: input.task.trim().slice(0, 120),
        head: branch,
        base: baseRef,
        body: `${input.summary.trim()}\n\nCreated by Locus after explicit approval.`,
      }),
    },
  );

  return {
    branch,
    pullRequestNumber: pullRequest.number,
    url: pullRequest.html_url,
  };
}
