import { FatalError } from "workflow";

import { runCodingTask } from "@/lib/agent/coding-agent";
import { fetchAgentRepository } from "@/lib/agent/github-source";
import { createVercelWorkspace } from "@/lib/agent/vercel-workspace";
import { WorkspaceController } from "@/lib/agent/workspace";
import { AgentScope, buildAgentPrompt } from "@/lib/agent/workspace-tools";
import { buildGraph, locate } from "@/lib/localizer";
import { serviceClient } from "@/lib/supabase";
import type { Database, Json } from "@/lib/database.types";

type AgentRunWorkflowInput = {
  runId: string;
};

type LocalizedRun = {
  runId: string;
  userId: string;
  task: string;
  acceptanceCriteria: string[];
  cloneUrl: string;
  revision: string;
  repo: Awaited<ReturnType<typeof fetchAgentRepository>>["repo"];
  included: string[];
  excluded: string[];
  reason: string;
  baselineTokens: number;
  includedTokens: number;
};

async function updateRun(
  runId: string,
  values: Database["public"]["Tables"]["agent_runs"]["Update"],
): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("agent_runs").update(values).eq("id", runId);
  if (error) throw new Error(`Could not update agent run: ${error.message}`);
}

async function recordStep(input: {
  runId: string;
  userId: string;
  sequence: number;
  kind: "localize" | "plan" | "tool" | "widen" | "verify" | "approval" | "delivery";
  status: "running" | "completed" | "failed" | "skipped";
  title: string;
  detail?: Json;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const db = serviceClient();
  const completedAt = input.status === "running" ? null : new Date().toISOString();
  const { error } = await db.from("agent_steps").upsert(
    {
      run_id: input.runId,
      user_id: input.userId,
      sequence: input.sequence,
      kind: input.kind,
      status: input.status,
      title: input.title,
      detail: input.detail ?? {},
      input_tokens: input.inputTokens ?? 0,
      output_tokens: input.outputTokens ?? 0,
      completed_at: completedAt,
    },
    { onConflict: "run_id,sequence" },
  );
  if (error) throw new Error(`Could not record agent step: ${error.message}`);
}

async function localizeRunStep(runId: string): Promise<LocalizedRun> {
  "use step";

  const db = serviceClient();
  const { data: run, error: runError } = await db
    .from("agent_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (runError || !run) throw new FatalError("Agent run was not found");

  const { data: task, error: taskError } = await db
    .from("agent_tasks")
    .select("*")
    .eq("id", run.task_id)
    .eq("user_id", run.user_id)
    .single();
  if (taskError || !task) throw new FatalError("Agent task was not found");

  await updateRun(runId, {
    status: "localizing",
    started_at: run.started_at ?? new Date().toISOString(),
    error: null,
  });
  await recordStep({
    runId,
    userId: run.user_id,
    sequence: 0,
    kind: "localize",
    status: "running",
    title: "Locate the smallest useful context",
  });

  const fetched = await fetchAgentRepository(task.repo_url, task.base_ref);
  const graph = buildGraph(fetched.repo);
  const result = locate(task.task, fetched.repo, graph);
  const included = result.slice.map((file) => file.path);
  const includedSet = new Set(included);
  const excluded = graph.nodes
    .map((node) => node.path)
    .filter((path) => !includedSet.has(path));

  await updateRun(runId, {
    status: "planning",
    baseline_tokens: result.totalTokens,
    included_files: included,
    excluded_files: excluded,
  });
  await recordStep({
    runId,
    userId: run.user_id,
    sequence: 0,
    kind: "localize",
    status: "completed",
    title: "Context Slice selected",
    detail: {
      reason: result.reason,
      includedFiles: included.length,
      excludedFiles: excluded.length,
      includedTokens: result.sliceTokens,
      baselineTokens: result.totalTokens,
      savedPercent: result.savedPct,
      repositoryTruncated: fetched.truncated,
    },
  });
  await recordStep({
    runId,
    userId: run.user_id,
    sequence: 1,
    kind: "plan",
    status: "completed",
    title: "Execution plan bounded to the Slice",
    detail: {
      acceptanceCriteria: task.acceptance_criteria,
      anchors: result.anchors,
    },
  });

  return {
    runId,
    userId: run.user_id,
    task: task.task,
    acceptanceCriteria: task.acceptance_criteria,
    cloneUrl: fetched.cloneUrl,
    revision: fetched.resolvedRevision,
    repo: fetched.repo,
    included,
    excluded,
    reason: result.reason,
    baselineTokens: result.totalTokens,
    includedTokens: result.sliceTokens,
  };
}

async function executeRunStep(localized: LocalizedRun): Promise<void> {
  "use step";

  await updateRun(localized.runId, { status: "executing" });
  await recordStep({
    runId: localized.runId,
    userId: localized.userId,
    sequence: 2,
    kind: "tool",
    status: "running",
    title: "Implement changes in an isolated sandbox",
  });

  const workspace = await createVercelWorkspace({
    repository: localized.cloneUrl,
    revision: localized.revision,
    runId: localized.runId,
  });
  const scope = new AgentScope({
    included: localized.included,
    excluded: localized.excluded,
  });
  const controller = new WorkspaceController(workspace, scope);

  try {
    await updateRun(localized.runId, { sandbox_id: workspace.id });
    const prompt = buildAgentPrompt({
      task: localized.task,
      acceptanceCriteria: localized.acceptanceCriteria,
      reason: localized.reason,
      baselineTokens: localized.baselineTokens,
      included: localized.included.flatMap((path) => {
        const content = localized.repo.files[path];
        return content === undefined ? [] : [{ path, content }];
      }),
      excluded: localized.excluded,
    });
    const result = await runCodingTask({
      prompt,
      controller,
      baselineContextTokens: localized.baselineTokens,
      includedContextTokens: localized.includedTokens,
    });
    const diff = await controller.diff();

    await updateRun(localized.runId, {
      status: "verifying",
      input_tokens: result.tokenLedger.inputTokens,
      output_tokens: result.tokenLedger.outputTokens,
      widened_files: result.ledger.widened,
    });
    await recordStep({
      runId: localized.runId,
      userId: localized.userId,
      sequence: 2,
      kind: "tool",
      status: "completed",
      title: "Repository changes prepared",
      detail: {
        changedFiles: result.output.changedFiles,
        createdFiles: result.ledger.created,
        widenedFiles: result.ledger.widened,
      },
      inputTokens: result.tokenLedger.inputTokens,
      outputTokens: result.tokenLedger.outputTokens,
    });
    await recordStep({
      runId: localized.runId,
      userId: localized.userId,
      sequence: 3,
      kind: "verify",
      status: "completed",
      title: "Verification evidence collected",
      detail: {
        checks: result.output.verification,
        risks: result.output.risks,
      },
    });

    const db = serviceClient();
    const { error: artifactError } = await db.from("agent_artifacts").insert([
      {
        run_id: localized.runId,
        user_id: localized.userId,
        kind: "diff",
        label: "Proposed repository diff",
        content: diff,
      },
      {
        run_id: localized.runId,
        user_id: localized.userId,
        kind: "summary",
        label: "Agent summary",
        content: result.output.summary,
      },
    ]);
    if (artifactError) throw new Error(`Could not store agent artifacts: ${artifactError.message}`);

    const { error: approvalError } = await db.from("agent_approvals").insert({
      run_id: localized.runId,
      user_id: localized.userId,
      action: "open_pull_request",
      payload: {
        repository: localized.cloneUrl,
        revision: localized.revision,
        changedFiles: result.output.changedFiles,
      },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (approvalError) throw new Error(`Could not create approval: ${approvalError.message}`);

    await recordStep({
      runId: localized.runId,
      userId: localized.userId,
      sequence: 4,
      kind: "approval",
      status: "running",
      title: "Waiting for approval before GitHub delivery",
    });
    await updateRun(localized.runId, { status: "awaiting_approval" });
  } finally {
    await workspace.stop();
  }
}

executeRunStep.maxRetries = 0;

async function failRunStep(runId: string, message: string): Promise<void> {
  "use step";

  const error = message.slice(0, 2_000);
  await updateRun(runId, {
    status: "failed",
    error,
    completed_at: new Date().toISOString(),
  });
}

export async function agentRunWorkflow(input: AgentRunWorkflowInput): Promise<void> {
  "use workflow";

  try {
    const localized = await localizeRunStep(input.runId);
    await executeRunStep(localized);
  } catch (error) {
    await failRunStep(
      input.runId,
      error instanceof Error ? error.message : "Agent workflow failed",
    );
  }
}
