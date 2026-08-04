import { FatalError } from "workflow";

import { runCodingTask } from "@/lib/agent/coding-agent";
import { fetchAgentRepository } from "@/lib/agent/github-source";
import { appendRunStep, failRun, patchRun, transitionRun } from "@/lib/agent/run-store";
import { createVercelWorkspace } from "@/lib/agent/vercel-workspace";
import { WorkspaceController } from "@/lib/agent/workspace";
import { AgentSlice, buildAgentPrompt } from "@/lib/agent/workspace-tools";
import { buildGraph, locate } from "@/lib/localizer";
import { serviceClient } from "@/lib/supabase";

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

  await transitionRun({
    runId,
    userId: run.user_id,
    current: "queued",
    next: "localizing",
    values: {
      started_at: run.started_at ?? new Date().toISOString(),
      error: null,
    },
  });

  const fetched = await fetchAgentRepository(task.repo_url, task.base_ref);
  const graph = buildGraph(fetched.repo);
  const result = locate(task.task, fetched.repo, graph);
  const included = result.slice.map((file) => file.path);
  const includedSet = new Set(included);
  const excluded = graph.nodes
    .map((node) => node.path)
    .filter((path) => !includedSet.has(path));

  await transitionRun({
    runId,
    userId: run.user_id,
    current: "localizing",
    next: "planning",
    values: {
      baseline_tokens: result.totalTokens,
      included_context_tokens: result.sliceTokens,
      included_files: included,
      excluded_files: excluded,
    },
  });
  await appendRunStep({
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
      repositoryTruncated: fetched.truncated,
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

  await transitionRun({
    runId: localized.runId,
    userId: localized.userId,
    current: "planning",
    next: "executing",
  });

  const workspace = await createVercelWorkspace({
    repository: localized.cloneUrl,
    revision: localized.revision,
    runId: localized.runId,
  });
  const slice = new AgentSlice({
    included: localized.included,
    excluded: localized.excluded,
  });
  const controller = new WorkspaceController(workspace, slice);

  try {
    await patchRun({
      runId: localized.runId,
      userId: localized.userId,
      current: "executing",
      values: { sandbox_id: workspace.id },
    });
    await controller.prepareDependencies();
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
    if (result.verification.length === 0) {
      throw new Error("Agent did not run an approved verification command");
    }
    const failedChecks = result.verification.filter((check) => check.exitCode !== 0);
    if (failedChecks.length > 0) {
      throw new Error(
        `Verification failed: ${failedChecks.map((check) => check.command).join(", ")}`,
      );
    }
    const widenedTokens = result.ledger.widened.reduce((total, path) => {
      const content = localized.repo.files[path];
      return total + (content ? Math.max(1, Math.round(content.length / 4)) : 0);
    }, 0);
    const effectiveContextTokens = Math.min(
      localized.baselineTokens,
      localized.includedTokens + widenedTokens,
    );
    const diff = await controller.reviewDiff();
    const changeSet = await controller.changeSet();
    if (changeSet.length === 0) throw new Error("Agent completed without repository changes");

    await transitionRun({
      runId: localized.runId,
      userId: localized.userId,
      current: "executing",
      next: "verifying",
      values: {
        included_context_tokens: effectiveContextTokens,
        input_tokens: result.tokenLedger.inputTokens,
        cached_input_tokens: result.tokenLedger.cachedInputTokens,
        output_tokens: result.tokenLedger.outputTokens,
        widened_files: result.ledger.widened,
      },
    });
    await appendRunStep({
      runId: localized.runId,
      userId: localized.userId,
      sequence: 2,
      kind: "tool",
      status: "completed",
      title: "Repository changes prepared",
      detail: {
        changedFiles: changeSet.map((change) => change.path),
        createdFiles: result.ledger.created,
        widenedFiles: result.ledger.widened,
      },
      inputTokens: result.tokenLedger.inputTokens,
      outputTokens: result.tokenLedger.outputTokens,
    });
    await appendRunStep({
      runId: localized.runId,
      userId: localized.userId,
      sequence: 3,
      kind: "verify",
      status: "completed",
      title: "Verification evidence collected",
      detail: {
        checks: result.verification,
        risks: result.output.risks,
      },
    });

    const db = serviceClient();
    const { error: artifactError } = await db.from("agent_artifacts").insert([
      {
        run_id: localized.runId,
        user_id: localized.userId,
        kind: "change_set",
        label: "Approval-gated delivery payload",
        content: JSON.stringify({
          version: 1,
          baseCommitSha: localized.revision,
          files: changeSet,
        }),
      },
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
        changedFiles: changeSet.map((change) => change.path),
      },
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (approvalError) throw new Error(`Could not create approval: ${approvalError.message}`);

    await transitionRun({
      runId: localized.runId,
      userId: localized.userId,
      current: "verifying",
      next: "awaiting_approval",
    });
  } finally {
    await workspace.stop();
  }
}

executeRunStep.maxRetries = 0;

async function failRunStep(runId: string, message: string): Promise<void> {
  "use step";

  await failRun(runId, message);
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
