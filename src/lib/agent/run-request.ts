import { CONTROLLED_ALPHA_DATA_POLICY_VERSION } from "@/lib/agent/data-policy";
import { publicGitHubCoordinates } from "@/lib/agent/github-source";
import {
  isAgentExecutionMode,
  type AgentExecutionMode,
} from "@/lib/agent/provider-config";
import { planWorkflowRun, type WorkflowPlan } from "@/lib/agent/workflows";

export { CONTROLLED_ALPHA_DATA_POLICY_VERSION } from "@/lib/agent/data-policy";

export type AgentRunRequest = {
  repository: string;
  baseRef: string;
  task: string;
  executionMode: AgentExecutionMode;
  acceptanceCriteria: string[];
  /** Set when the Run came from a named workflow rather than free text. */
  workflowId: string | null;
  dataPolicyVersion: typeof CONTROLLED_ALPHA_DATA_POLICY_VERSION;
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

/**
 * Read an optional `workflow: { id, values }` selection and turn it into a plan.
 *
 * Returns null when no workflow was named, so free-text Runs are unaffected.
 * Every failure is a WorkflowInputError carrying an operator-facing message.
 */
function parseWorkflowSelection(body: Record<string, unknown>): WorkflowPlan | null {
  const workflow = body.workflow;
  if (workflow === undefined || workflow === null) return null;
  if (typeof workflow !== "object" || Array.isArray(workflow)) {
    throw new Error("workflow must be an object with an id and values");
  }
  const selection = workflow as Record<string, unknown>;
  const id = typeof selection.id === "string" ? selection.id.trim() : "";
  if (!id) throw new Error("workflow.id is required");

  const rawValues = selection.values ?? {};
  if (typeof rawValues !== "object" || rawValues === null || Array.isArray(rawValues)) {
    throw new Error("workflow.values must be an object");
  }
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawValues as Record<string, unknown>)) {
    if (typeof value !== "string") {
      throw new Error(`workflow.values.${key} must be text`);
    }
    values[key] = value;
  }
  return planWorkflowRun(id, values);
}

export function parseAgentRunRequest(input: unknown): AgentRunRequest {
  if (!input || typeof input !== "object") throw new Error("Request body must be an object");
  const body = input as Record<string, unknown>;
  const repositorySpecifier = typeof body.repository === "string" ? body.repository.trim() : "";

  // R16: a Run may name a workflow instead of writing its own task. The
  // template then owns the task text and the acceptance criteria, which is the
  // entire point — a repeated job whose wording drifts per Run produces Runs
  // that cannot be compared. Supplying both is refused rather than silently
  // resolved, because either choice would surprise someone.
  const plan = parseWorkflowSelection(body);
  if (plan) {
    if (typeof body.task === "string" && body.task.trim()) {
      throw new Error("Send either a workflow or a task, not both");
    }
    if (Array.isArray(body.acceptanceCriteria) && body.acceptanceCriteria.length > 0) {
      throw new Error("A workflow supplies its own acceptance criteria");
    }
  }

  const task = plan ? plan.task : (typeof body.task === "string" ? body.task.trim() : "");
  const requestedBaseRef = typeof body.baseRef === "string" && body.baseRef.trim()
    ? body.baseRef.trim()
    : undefined;
  const executionMode = body.executionMode === undefined ? "shared" : body.executionMode;

  if (!isAgentExecutionMode(executionMode)) {
    throw new Error("Execution mode must be shared or byok");
  }

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

  const rawCriteria = plan ? plan.acceptanceCriteria : (body.acceptanceCriteria ?? []);
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

  const dataPolicyAcceptance = body.dataPolicyAcceptance;
  if (
    !dataPolicyAcceptance
    || typeof dataPolicyAcceptance !== "object"
    || (dataPolicyAcceptance as Record<string, unknown>).version
      !== CONTROLLED_ALPHA_DATA_POLICY_VERSION
  ) {
    throw new Error(
      "Confirm the early-access data policy before starting an Agent Run",
    );
  }

  return {
    repository,
    baseRef,
    task,
    executionMode,
    acceptanceCriteria,
    workflowId: plan?.workflowId ?? null,
    dataPolicyVersion: CONTROLLED_ALPHA_DATA_POLICY_VERSION,
  };
}
