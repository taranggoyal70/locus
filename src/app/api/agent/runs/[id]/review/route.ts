import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { parseAgentReviewRequest } from "@/lib/agent/run-review";
import { decideRunProposal } from "@/lib/agent/run-store";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const MAX_REVIEW_BODY_BYTES = 160_000;

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid run identifier." }, { status: 400 });
  }

  let review;
  try {
    const body = await readLimitedJson(request, MAX_REVIEW_BODY_BYTES);
    if (!body.ok) return NextResponse.json({ error: body.error }, { status: body.status });
    review = parseAgentReviewRequest(body.value);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid review decision." },
      { status: 400 },
    );
  }

  try {
    const result = await decideRunProposal({
      runId: id,
      userId,
      proposalHash: review.proposalHash,
      decision: review.decision,
      criteria: review.criteria,
      note: review.note,
    });
    return NextResponse.json({ status: result.status, reviewId: result.reviewId });
  } catch {
    return NextResponse.json(
      { error: "The proposal changed or this Run is no longer awaiting review." },
      { status: 409 },
    );
  }
}
