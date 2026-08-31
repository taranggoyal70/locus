import { FatalError } from "workflow";

import {
  assertCandidateIntegrity,
  buildDeterministicDiff,
  freezeCandidate,
} from "@/lib/agent/candidate";
import { runCodingTask } from "@/lib/agent/coding-agent";
import { sendOperationalAlert } from "@/lib/agent/operations";
import {
  IncompleteRepositoryError,
  assertCompleteRepository,
  fetchAgentRepository,
} from "@/lib/agent/github-source";
import {
  agentFailureMessage,
  classifyAgentFailure,
  type AgentFailureKind,
} from "@/lib/agent/run-budget";
import { resolveRunAgentModel } from "@/lib/agent/provider";
import {
  CLOUDFLARE_PROVIDER,
  isAgentExecutionMode,
  type AgentExecutionMode,
} from "@/lib/agent/provider-config";
import {
  appendRunStep,
  failRun,
  patchRun,
  publishRunProposal,
  releaseRunProviderLease,
  transitionRun,
} from "@/lib/agent/run-store";
import { createVercelWorkspace } from "@/lib/agent/vercel-workspace";
import { verifyFrozenCandidate } from "@/lib/agent/verification";
import { MAX_REVIEW_DIFF_CHARACTERS, WorkspaceController } from "@/lib/agent/workspace";
import { AgentSlice, buildAgentPrompt } from "@/lib/agent/workspace-tools";
import { buildGraph, locate } from "@/lib/localizer";
import { logger } from "@/lib/logger";
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
  widened: boolean;
  sparse: boolean;
  edgeDensity: number;
  baselineTokens: number;
  includedTokens: number;
  tokenBudget: number;
  model: string;
  executionMode: AgentExecutionMode;
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
  if (run.provider !== CLOUDFLARE_PROVIDER || !isAgentExecutionMode(run.execution_mode)) {
    throw new FatalError("Agent run provider policy is unavailable");
  }

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
  // R11: fail closed before any Agent capability is granted. A truncated view
  // makes the excluded ledger incomplete rather than merely short, so the
  // Agent cannot widen into a file it never learned exists, and the trusted
  // base used to rebuild the review diff would describe a different tree.
  // The review permits an override, but only one that is explicitly approved
  // and disables automated delivery, and no such approval path exists yet.
  assertCompleteRepository(fetched);
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
    sequence: 1,
    kind: "localize",
    status: "completed",
    title: "Context Slice selected",
    detail: {
      reason: result.reason,
      includedFiles: included.length,
      excludedFiles: excluded.length,
      includedTokens: result.sliceTokens,
      baselineTokens: result.totalTokens,
      sparse: result.sparse,
      edgeDensity: Number(result.edgeDensity.toFixed(3)),
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
    widened: result.widened,
    sparse: result.sparse,
    edgeDensity: result.edgeDensity,
    baselineTokens: result.totalTokens,
    includedTokens: result.sliceTokens,
    tokenBudget: run.token_budget,
    model: run.model,
    executionMode: run.execution_mode,
  };
}

async function executeRunStep(localized: LocalizedRun): Promise<void> {
  "use step";

  const languageModel = await resolveRunAgentModel({
    userId: localized.userId,
    executionMode: localized.executionMode,
    frozenModel: localized.model,
  });

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
  let editWorkspaceStopped = false;

  try {
    await patchRun({
      runId: localized.runId,
      userId: localized.userId,
      current: "executing",
      values: { sandbox_id: workspace.id },
    });
    await controller.prepareDependencies();
    // R2: bootstrap is the last phase that legitimately needs egress. Revoke
    // it before the agent touches the repository, so every subsequent
    // repository-controlled program — every `pnpm test`, every build script —
    // runs with no route out. A failure here aborts the Run: the sandbox is
    // torn down by the finally block rather than continuing with egress.
    await controller.lockNetwork();
    logger.info("agent.sandbox.network_locked", { sandboxId: workspace.id }, localized.runId);
    const prompt = buildAgentPrompt({
      task: localized.task,
      acceptanceCriteria: localized.acceptanceCriteria,
      reason: localized.reason,
      baselineTokens: localized.baselineTokens,
      sparse: localized.sparse && !localized.widened,
      edgeDensity: localized.edgeDensity,
      included: localized.included,
      excluded: localized.excluded,
    });
    const cumulativeUsage = {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
    };
    const result = await runCodingTask({
      prompt,
      controller,
      baselineContextTokens: localized.baselineTokens,
      includedContextTokens: localized.includedTokens,
      model: languageModel,
      tokenBudgetTokens: localized.tokenBudget,
      onStepStart: ({ stepNumber, provider, modelId }) => {
        logger.info(
          "agent.model.step_started",
          { stepNumber, provider, modelId },
          localized.runId,
        );
      },
      onToolExecutionStart: ({ toolName }) => {
        logger.info("agent.tool.started", { toolName }, localized.runId);
      },
      onToolExecutionEnd: ({ toolName, durationMs, failed }) => {
        logger.info(
          "agent.tool.completed",
          { toolName, durationMs, failed },
          localized.runId,
        );
      },
      onStepEnd: async (usage) => {
        cumulativeUsage.inputTokens += Math.max(0, usage.inputTokens ?? 0);
        cumulativeUsage.cachedInputTokens += Math.max(
          0,
          usage.inputTokenDetails.cacheReadTokens ?? 0,
        );
        cumulativeUsage.outputTokens += Math.max(0, usage.outputTokens ?? 0);
        await patchRun({
          runId: localized.runId,
          userId: localized.userId,
          current: "executing",
          values: {
            input_tokens: cumulativeUsage.inputTokens,
            cached_input_tokens: cumulativeUsage.cachedInputTokens,
            output_tokens: cumulativeUsage.outputTokens,
          },
        });
      },
    });
    if (result.verification.length === 0) {
      throw new Error("Agent did not run an approved verification command");
    }
    // The agent's in-loop checks are feedback, not evidence. They ran in the
    // sandbox it was editing, so they describe whatever tree existed at the
    // moment they ran. Which commands to trust comes from here; whether they
    // pass is decided later, against the frozen candidate in a fresh sandbox.
    const verificationCommands = [...new Set(result.verification.map((check) => check.command))];
    const widenedTokens = result.ledger.widened.reduce((total, path) => {
      const content = localized.repo.files[path];
      return total + (content ? Math.max(1, Math.round(content.length / 4)) : 0);
    }, 0);
    const effectiveContextTokens = Math.min(
      localized.baselineTokens,
      localized.includedTokens + widenedTokens,
    );
    // R1: capture the candidate exactly once. Everything downstream is derived
    // from these frozen bytes and the trusted base — never from a second read
    // of a sandbox tree that repository-controlled verification has already
    // had the opportunity to rewrite.
    const changeSet = await controller.changeSet();
    if (changeSet.length === 0) throw new Error("Agent completed without repository changes");
    const candidate = freezeCandidate({
      baseSha: localized.revision,
      changes: changeSet,
    });

    // The base is the tree fetched server-side at the resolved revision, not
    // anything the sandbox reported about itself.
    const base = new Map(Object.entries(localized.repo.files));
    const createdPaths = new Set(result.ledger.created);
    for (const file of candidate.files) {
      // A modified file must exist in the trusted base. If it does not, the
      // sandbox is describing a tree we never fetched — a truncated repository
      // view (R11) or a path that bypassed the Slice.
      if (!createdPaths.has(file.path) && !base.has(file.path)) {
        throw new Error(`Changed file is absent from the trusted base: ${file.path}`);
      }
    }

    // R1/R2 verification isolation. The edit sandbox has run
    // repository-controlled programs, so the tree it holds is no longer evidence
    // about anything. Destroy it, materialize exactly the frozen candidate into a
    // fresh sandbox with no egress, and take the verification result from there.
    // That is what makes "tests passed" describe the bytes being delivered.
    await workspace.stop();
    editWorkspaceStopped = true;

    const verificationWorkspace = await createVercelWorkspace({
      repository: localized.cloneUrl,
      revision: localized.revision,
      runId: `${localized.runId}-verify`,
    });
    let isolated;
    try {
      const verificationController = new WorkspaceController(
        verificationWorkspace,
        new AgentSlice({ included: localized.included, excluded: localized.excluded }),
      );
      await verificationController.prepareDependencies();
      await verificationController.lockNetwork();
      isolated = await verifyFrozenCandidate({
        workspace: verificationWorkspace,
        candidate,
        commands: verificationCommands,
        networkIsLocked: verificationController.networkIsLocked(),
      });
    } finally {
      await verificationWorkspace.stop();
    }
    logger.info(
      "agent.candidate.verified_in_isolation",
      { sandboxId: isolated.sandboxId, candidateSha256: isolated.candidateSha256 },
      localized.runId,
    );

    const failedChecks = isolated.checks.filter((check) => check.exitCode !== 0);
    if (failedChecks.length > 0) {
      throw new Error(
        `Verification failed against the frozen candidate: ${failedChecks
          .map((check) => check.command)
          .join(", ")}`,
      );
    }

    const diff = buildDeterministicDiff(base, candidate);
    if (diff.length > MAX_REVIEW_DIFF_CHARACTERS) {
      throw new Error("Review diff exceeds the 500,000 character approval limit");
    }
    // Refuse to publish unless the artifact the human will review reconstructs
    // the artifact that would be delivered, byte for byte.
    assertCandidateIntegrity({ base, diff, candidate });

    const proposalHash = await publishRunProposal({
      runId: localized.runId,
      userId: localized.userId,
      baseRevision: localized.revision,
      changeSetContent: JSON.stringify({
        version: 2,
        baseCommitSha: candidate.baseSha,
        candidateSha256: candidate.candidateSha256,
        files: changeSet,
      }),
      diff,
      summary: result.output.summary,
      toolDetail: {
        changedFiles: changeSet.map((change) => change.path),
        createdFiles: result.ledger.created,
        widenedFiles: result.ledger.widened,
        // R6: the justification for each capability grant travels into the
        // approval evidence. toolDetail is hashed into proposal_hash, so the
        // reason the reviewer reads is bound to the decision they make.
        widenReasons: result.ledger.widenReasons,
      },
      verifyDetail: {
        // Evidence from the isolated sandbox, bound to the candidate digest it
        // was produced against, so a reviewer can tell which tree was tested.
        checks: isolated.checks,
        candidateSha256: isolated.candidateSha256,
        risks: result.output.risks,
      },
      includedContextTokens: effectiveContextTokens,
      inputTokens: result.tokenLedger.inputTokens,
      cachedInputTokens: result.tokenLedger.cachedInputTokens,
      outputTokens: result.tokenLedger.outputTokens,
      widenedFiles: result.ledger.widened,
      excludedFiles: result.ledger.excluded,
    });
    logger.info(
      "agent.run.review_ready",
      {
        inputTokens: result.tokenLedger.inputTokens,
        outputTokens: result.tokenLedger.outputTokens,
        proposalHash,
      },
      localized.runId,
    );
  } finally {
    // The edit sandbox is torn down before verification on the success path, so
    // only stop it here if that never happened.
    if (!editWorkspaceStopped) await workspace.stop();
  }
}

executeRunStep.maxRetries = 0;

async function failRunStep(
  runId: string,
  message: string,
  failureKind: AgentFailureKind,
  cause?: string,
): Promise<void> {
  "use step";

  await failRun(runId, message, failureKind);
  // `message` is the text a user reads, so it stays generic per failure kind.
  // Without the underlying cause recorded somewhere, though, a TypeError in the
  // localizer and a missing Vercel OIDC credential both surface as
  // `workflow_error` with byte-identical output, and neither is diagnosable from
  // production. The logger sanitizes this payload, redacting sensitive keys and
  // secret-shaped values, so the real text is safe to record here.
  logger.error("agent.run.failed", { failureKind, cause }, runId);
  await sendOperationalAlert({ event: "agent.run.failed", runId, failureKind });
}

async function releaseProviderLeaseStep(runId: string): Promise<void> {
  "use step";

  try {
    await releaseRunProviderLease(runId);
  } catch {
    logger.error("agent.provider_lease.release_failed", {}, runId);
  }
}

export async function agentRunWorkflow(input: AgentRunWorkflowInput): Promise<void> {
  "use workflow";

  try {
    const localized = await localizeRunStep(input.runId);
    await executeRunStep(localized);
  } catch (error) {
    const failureKind = classifyAgentFailure(error);
    // R11: the generic per-kind text would not tell an operator what went
    // wrong or what to do, so this one failure carries its own message.
    const message = error instanceof IncompleteRepositoryError
      ? error.message
      : agentFailureMessage(failureKind);
    await failRunStep(
      input.runId,
      message,
      failureKind,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    await releaseProviderLeaseStep(input.runId);
  }
}
