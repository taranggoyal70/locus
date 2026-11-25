import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { sha256Hex } from "@/lib/agent/candidate";
import { buildProposalPatch, ProposalPatchError } from "@/lib/agent/proposal-patch";
import { proposalPatchAvailable } from "@/lib/agent/run-review";
import { tenantDb } from "@/lib/db";
import { logger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * The proposal as a patch its owner can apply to their own checkout.
 *
 * This is a read of evidence the owner can already see, not a delivery: Locus
 * writes nothing outside itself, so it needs no delivery Capability and no
 * Approval (ADR-0002). A rejected proposal has no patch.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid run identifier." }, { status: 400 });
  }

  const db = tenantDb(userId);
  let run, artifacts, reviews;
  try {
    run = await db
      .selectFrom("agent_runs")
      .select(["id", "status", "proposal_hash"])
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    if (!run) return NextResponse.json({ error: "Agent run not found." }, { status: 404 });
    [artifacts, reviews] = await Promise.all([
      db.selectFrom("agent_artifacts").select(["kind", "content", "content_sha256", "base_revision"])
        .where("run_id", "=", id).where("user_id", "=", userId).where("kind", "in", ["change_set", "diff"])
        .execute(),
      db.selectFrom("agent_reviews").select(["decision", "proposal_hash"])
        .where("run_id", "=", id).where("user_id", "=", userId)
        .execute(),
    ]);
  } catch {
    return NextResponse.json({ error: "Could not load the proposal." }, { status: 503 });
  }

  const changeSet = artifacts.find((artifact) => artifact.kind === "change_set");
  const diff = artifacts.find((artifact) => artifact.kind === "diff");
  if (!proposalPatchAvailable(run, reviews) || !run.proposal_hash || !changeSet?.content || !diff?.content) {
    return NextResponse.json({ error: "This Run has no proposal to download." }, { status: 409 });
  }

  try {
    for (const artifact of [changeSet, diff]) {
      if (sha256Hex(artifact.content ?? "") !== artifact.content_sha256) {
        throw new ProposalPatchError(`The stored ${artifact.kind} does not match its recorded hash`);
      }
    }
    const patch = buildProposalPatch({
      runId: run.id,
      proposalHash: run.proposal_hash,
      reviewed: run.status === "completed",
      changeSet: changeSet.content,
      diff: diff.content,
    });
    if (patch.baseRevision !== diff.base_revision) {
      throw new ProposalPatchError("The stored base revisions disagree");
    }
    return new NextResponse(patch.content, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${patch.filename}"`,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    logger.error(
      "agent.proposal_patch.refused",
      { cause: error instanceof Error ? error.message : String(error) },
      run.id,
    );
    return NextResponse.json(
      { error: "The stored proposal failed its integrity check, so no patch was produced." },
      { status: 409 },
    );
  }
}
