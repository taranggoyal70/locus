import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { timingSafeEqual } from "node:crypto";

import { freezeCandidate } from "@/lib/agent/candidate";
import { createGitHubPullRequest } from "@/lib/agent/github-delivery";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { appendRunStep, transitionRun } from "@/lib/agent/run-store";
import type { AgentChange } from "@/lib/agent/workspace";
import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";
import { tenantClient } from "@/lib/supabase-tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PROPOSAL_HASH = /^[0-9a-f]{64}$/;
const MAX_APPROVAL_BODY_BYTES = 4_096;

function timingSafeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  // Both values are validated as 64 hex characters before reaching here, so a
  // mismatch is a genuine inequality rather than a shape difference.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!alphaCapabilitiesForUser(userId).delivery) {
    return NextResponse.json(
      { error: "GitHub delivery is disabled during the controlled alpha." },
      { status: 403 },
    );
  }
  // The shared guard, as used by every other mutation route. The inline
  // `sec-fetch-site === "cross-site"` check this replaced allowed `same-site`, so a
  // sibling subdomain could drive delivery with the user's cookies, and allowed a
  // request carrying no Fetch Metadata or a foreign Origin at all. This is the
  // route that writes to GitHub, so it had the weakest check and the highest
  // consequence.
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid run identifier." }, { status: 400 });
  }

  // R10: delivery must name the artifact it is delivering.
  //
  // This endpoint previously required only that the Run was awaiting approval,
  // so it approved "whatever proposal is current" rather than the one a human
  // read. That made it a second approval path alongside /review, which is
  // bound to a proposal hash by decide_agent_proposal, and a second path that
  // is not bound is a way around the one that is.
  const body = await readLimitedJson<{ proposalHash?: unknown }>(
    request,
    MAX_APPROVAL_BODY_BYTES,
  );
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
  const submittedHash = (body.value as { proposalHash?: unknown } | null)?.proposalHash;
  if (typeof submittedHash !== "string" || !PROPOSAL_HASH.test(submittedHash)) {
    return NextResponse.json(
      { error: "proposalHash (64 hex characters) is required to approve delivery." },
      { status: 400 },
    );
  }

  const db = tenantClient(userId);
  const { data: run, error: runError } = await db
    .from("agent_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "awaiting_approval")
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "This run is not awaiting approval." }, { status: 409 });
  }

  // Compared in constant time so a caller cannot recover the stored hash by
  // timing repeated guesses.
  if (!run.proposal_hash || !timingSafeEquals(run.proposal_hash, submittedHash)) {
    return NextResponse.json(
      { error: "The proposal changed since it was reviewed. Re-read the diff before approving." },
      { status: 409 },
    );
  }

  const [taskResult, changeSetResult, summaryResult, connectionResult] = await Promise.all([
    db.from("agent_tasks").select("*").eq("id", run.task_id).eq("user_id", userId).single(),
    db
      .from("agent_artifacts")
      .select("content")
      .eq("run_id", id)
      .eq("user_id", userId)
      .eq("kind", "change_set")
      .single(),
    db
      .from("agent_artifacts")
      .select("content")
      .eq("run_id", id)
      .eq("user_id", userId)
      .eq("kind", "summary")
      .single(),
    db.from("github_connections").select("access_token").eq("user_id", userId).single(),
  ]);
  if (connectionResult.error || !connectionResult.data?.access_token) {
    return NextResponse.json(
      { error: "Connect GitHub in Settings before approving delivery." },
      { status: 409 },
    );
  }
  if (taskResult.error || !taskResult.data || changeSetResult.error || !changeSetResult.data?.content) {
    return NextResponse.json({ error: "The delivery payload is incomplete." }, { status: 409 });
  }

  const { data: approval, error: claimError } = await db
    .from("agent_approvals")
    .update({ status: "delivering", decided_at: new Date().toISOString() })
    .eq("run_id", id)
    .eq("user_id", userId)
    .eq("action", "open_pull_request")
    .in("status", ["pending", "failed"])
    .select("*")
    .single();
  if (claimError || !approval) {
    return NextResponse.json(
      { error: "Delivery is already running or was previously approved." },
      { status: 409 },
    );
  }

  try {
    const parsed = JSON.parse(changeSetResult.data.content) as {
      version?: unknown;
      baseCommitSha?: unknown;
      candidateSha256?: unknown;
      files?: unknown;
    };
    // Version 2 carries the frozen candidate digest (R1). Version 1 payloads
    // predate it and cannot be verified, so they are not deliverable.
    if (
      parsed.version !== 2
      || typeof parsed.baseCommitSha !== "string"
      || typeof parsed.candidateSha256 !== "string"
      || !Array.isArray(parsed.files)
    ) {
      throw new Error("Unsupported delivery payload");
    }
    const changes = parsed.files as AgentChange[];
    // R1: deliver the exact approved candidate. Re-derive the digest from the
    // stored bytes rather than trusting the stored digest, so any mutation of
    // the change set between approval and delivery fails closed here.
    const recomputed = freezeCandidate({
      baseSha: parsed.baseCommitSha,
      changes,
    });
    if (recomputed.candidateSha256 !== parsed.candidateSha256) {
      throw new Error("Approved change set no longer matches its frozen candidate digest");
    }
    const delivered = await createGitHubPullRequest({
      token: connectionResult.data.access_token,
      repository: taskResult.data.repo_url,
      baseRef: taskResult.data.base_ref,
      expectedBaseSha: parsed.baseCommitSha,
      runId: run.id,
      task: taskResult.data.task,
      summary: summaryResult.data?.content ?? "Locus completed the requested engineering task.",
      changes,
    });
    const completedAt = new Date().toISOString();

    const [approvalUpdate, artifactInsert] = await Promise.all([
      db
        .from("agent_approvals")
        .update({
          status: "approved",
          decided_at: completedAt,
          payload: {
            ...(typeof approval.payload === "object" && approval.payload && !Array.isArray(approval.payload)
              ? approval.payload
              : {}),
            branch: delivered.branch,
            pullRequestNumber: delivered.pullRequestNumber,
            url: delivered.url,
          },
        })
        .eq("id", approval.id)
        .eq("user_id", userId),
      db.from("agent_artifacts").insert({
        run_id: id,
        user_id: userId,
        kind: "pull_request",
        label: `Pull request #${delivered.pullRequestNumber}`,
        url: delivered.url,
      }),
    ]);
    if (approvalUpdate.error || artifactInsert.error) {
      throw new Error("GitHub delivery succeeded, but the run ledger could not be finalized");
    }
    await appendRunStep({
      runId: id,
      userId,
      sequence: 5,
      kind: "delivery",
      status: "completed",
      title: "Pull request opened after approval",
      detail: { url: delivered.url, branch: delivered.branch },
    });
    await transitionRun({
      runId: id,
      userId,
      current: "awaiting_approval",
      next: "completed",
      values: {
        branch_name: delivered.branch,
        error: null,
        completed_at: completedAt,
      },
    });

    return NextResponse.json({ delivery: delivered });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "GitHub delivery failed";
    await Promise.all([
      db
        .from("agent_approvals")
        .update({ status: "failed", payload: { error: message } })
        .eq("id", approval.id)
        .eq("user_id", userId),
      db
        .from("agent_runs")
        .update({ error: `Delivery failed: ${message}` })
        .eq("id", id)
        .eq("user_id", userId),
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
