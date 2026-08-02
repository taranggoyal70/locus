import { publicGitHubCoordinates } from "@/lib/agent/github-source";

export type AgentRunRequest = {
  repository: string;
  baseRef: string;
  task: string;
  acceptanceCriteria: string[];
};

function parseRepositorySpecifier(input: string): { repository: string; baseRef?: string } {
  const short = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:@([A-Za-z0-9_./-]+))?$/);
  if (short) {
    return {
      repository: `${short[1]}/${short[2].replace(/\.git$/, "")}`,
      baseRef: short[3],
    };
  }

  try {
    const url = new URL(input);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
      throw new Error("unsupported host");
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const owner = parts[0];
    const repo = parts[1]?.replace(/\.git$/, "");
    const baseRef = parts[2] === "tree" && parts.length > 3
      ? parts.slice(3).join("/")
      : undefined;
    if (
      !owner
      || !repo
      || ![owner, repo].every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
      || (parts.length > 2 && !baseRef)
    ) {
      throw new Error("unsupported path");
    }
    return { repository: `${owner}/${repo}`, baseRef };
  } catch {
    throw new Error("Repository must be owner/repository, owner/repository@revision, or a GitHub URL");
  }
}

export function parseAgentRunRequest(input: unknown): AgentRunRequest {
  if (!input || typeof input !== "object") throw new Error("Request body must be an object");
  const body = input as Record<string, unknown>;
  const repositorySpecifier = typeof body.repository === "string" ? body.repository.trim() : "";
  const task = typeof body.task === "string" ? body.task.trim() : "";
  const requestedBaseRef = typeof body.baseRef === "string" && body.baseRef.trim()
    ? body.baseRef.trim()
    : undefined;

  if (!repositorySpecifier || repositorySpecifier.length > 300) {
    throw new Error("Repository is required and must be under 300 characters");
  }
  const parsedRepository = parseRepositorySpecifier(repositorySpecifier);
  const repository = parsedRepository.repository;
  const baseRef = requestedBaseRef ?? parsedRepository.baseRef ?? "main";
  publicGitHubCoordinates(repository);
  if (task.length < 10) throw new Error("Describe the task in at least 10 characters");
  if (task.length > 5_000) throw new Error("Task must be under 5,000 characters");
  if (!/^[A-Za-z0-9_./-]{1,200}$/.test(baseRef)) {
    throw new Error("Base branch or revision contains unsupported characters");
  }

  const rawCriteria = body.acceptanceCriteria ?? [];
  if (!Array.isArray(rawCriteria)) throw new Error("Acceptance criteria must be a list");
  if (rawCriteria.length > 12) throw new Error("No more than 12 acceptance criteria are allowed");
  const acceptanceCriteria = rawCriteria.map((criterion) => {
    if (typeof criterion !== "string") throw new Error("Each acceptance criterion must be text");
    const value = criterion.trim();
    if (!value || value.length > 500) {
      throw new Error("Each acceptance criterion must be between 1 and 500 characters");
    }
    return value;
  });

  return { repository, baseRef, task, acceptanceCriteria };
}
