import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { timingSafeEqual } from "node:crypto";

import { accountCan } from "@/lib/admission-server";
import { freezeCandidate } from "@/lib/agent/candidate";
import { createGitHubPullRequest } from "@/lib/agent/github-delivery";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { appendRunStep, transitionRun } from "@/lib/agent/run-store";
import type { AgentChange } from "@/lib/agent/workspace";
import { jsonb, tenantDb } from "@/lib/db";

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
  if (!(await accountCan(userId, "delivery"))) {
    return NextResponse.json(
      { error: "GitHub delivery is disabled during early access." },
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

  const db = tenantDb(userId);
  const run = await db
    .selectFrom("agent_runs")
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "awaiting_approval")
    .executeTakeFirst()
    .catch(() => undefined);
  if (!run) {
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

  // Each read fails on its own terms, so an unreadable row is treated exactly
  // like a missing one and the caller gets the specific reason.
  const artifact = (kind: "change_set" | "summary") => db
    .selectFrom("agent_artifacts")
    .select("content")
    .where("run_id", "=", id)
    .where("user_id", "=", userId)
    .where("kind", "=", kind)
    .executeTakeFirst()
    .catch(() => undefined);
  const [task, changeSet, summary, connection] = await Promise.all([
    db.selectFrom("agent_tasks").selectAll().where("id", "=", run.task_id).where("user_id", "=", userId)
      .executeTakeFirst().catch(() => undefined),
    artifact("change_set"),
    artifact("summary"),
    db.selectFrom("github_connections").select("access_token").where("user_id", "=", userId)
      .executeTakeFirst().catch(() => undefined),
  ]);
  if (!connection?.access_token) {
    return NextResponse.json(
      { error: "Connect GitHub in Settings before approving delivery." },
      { status: 409 },
    );
  }
  if (!task || !changeSet?.content) {
    return NextResponse.json({ error: "The delivery payload is incomplete." }, { status: 409 });
  }

  // Claiming the approval is the compare-and-swap that makes delivery run once.
  const approval = await db
    .updateTable("agent_approvals")
    .set({ status: "delivering", decided_at: new Date().toISOString() })
    .where("run_id", "=", id)
    .where("user_id", "=", userId)
    .where("action", "=", "open_pull_request")
    .where("status", "in", ["pending", "failed"])
    .returningAll()
    .executeTakeFirst()
    .catch(() => undefined);
  if (!approval) {
    return NextResponse.json(
      { error: "Delivery is already running or was previously approved." },
      { status: 409 },
    );
  }

  try {
    const parsed = JSON.parse(changeSet.content) as {
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
      token: connection.access_token,
      repository: task.repo_url,
      baseRef: task.base_ref,
      expectedBaseSha: parsed.baseCommitSha,
      runId: run.id,
      task: task.task,
      summary: summary?.content ?? "Locus completed the requested engineering task.",
      changes,
    });
    const completedAt = new Date().toISOString();

    try {
      await Promise.all([
        db
          .updateTable("agent_approvals")
          .set({
            status: "approved",
            decided_at: completedAt,
            payload: jsonb({
              ...(typeof approval.payload === "object" && approval.payload && !Array.isArray(approval.payload)
                ? approval.payload
                : {}),
              branch: delivered.branch,
              pullRequestNumber: delivered.pullRequestNumber,
              url: delivered.url,
            }),
          })
          .where("id", "=", approval.id)
          .where("user_id", "=", userId)
          .execute(),
        db.insertInto("agent_artifacts").values({
          run_id: id,
          user_id: userId,
          kind: "pull_request",
          label: `Pull request #${delivered.pullRequestNumber}`,
          url: delivered.url,
        }).execute(),
      ]);
    } catch (cause) {
      throw new Error("GitHub delivery succeeded, but the run ledger could not be finalized", { cause });
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
    // Best effort, as before: the delivery failure is the answer the caller
    // needs, and a ledger write that also fails must not replace it.
    await Promise.allSettled([
      db
        .updateTable("agent_approvals")
        .set({ status: "failed", payload: jsonb({ error: message }) })
        .where("id", "=", approval.id)
        .where("user_id", "=", userId)
        .execute(),
      db
        .updateTable("agent_runs")
        .set({ error: `Delivery failed: ${message}` })
        .where("id", "=", id)
        .where("user_id", "=", userId)
        .execute(),
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
