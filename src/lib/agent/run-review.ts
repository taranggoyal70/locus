export type AgentCriterionDecision = {
  criterion: string;
  satisfied: boolean;
  evidence?: string;
};

export type AgentReviewRequest = {
  proposalHash: string;
  decision: "accepted" | "rejected";
  criteria: AgentCriterionDecision[];
  note: string | null;
};

export function reviewDecisionAvailability(
  criteria: AgentCriterionDecision[],
): { canAccept: boolean; canReject: boolean } {
  return {
    canAccept: criteria.length > 0 && criteria.every((criterion) => criterion.satisfied),
    canReject: criteria.length > 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAgentReviewRequest(value: unknown): AgentReviewRequest {
  if (!isRecord(value)) throw new Error("Review request must be a JSON object.");
  if (typeof value.proposalHash !== "string" || !/^[0-9a-f]{64}$/.test(value.proposalHash)) {
    throw new Error("A valid proposal hash is required.");
  }
  if (value.decision !== "accepted" && value.decision !== "rejected") {
    throw new Error("Review decision must be accepted or rejected.");
  }
  if (!Array.isArray(value.criteria) || value.criteria.length < 1 || value.criteria.length > 50) {
    throw new Error("At least one criterion decision is required.");
  }
  const criteria = value.criteria.map((item): AgentCriterionDecision => {
    if (
      !isRecord(item)
      || typeof item.criterion !== "string"
      || item.criterion.trim().length < 1
      || item.criterion.length > 1_000
      || typeof item.satisfied !== "boolean"
      || (item.evidence !== undefined
        && (typeof item.evidence !== "string" || item.evidence.length > 2_000))
    ) {
      throw new Error("Every criterion decision must include a criterion and boolean result.");
    }
    return {
      criterion: item.criterion.trim(),
      satisfied: item.satisfied,
      ...(typeof item.evidence === "string" && item.evidence.trim()
        ? { evidence: item.evidence.trim() }
        : {}),
    };
  });
  if (value.note !== undefined && value.note !== null && typeof value.note !== "string") {
    throw new Error("Review note must be text.");
  }
  const note = typeof value.note === "string" ? value.note.trim() : null;
  if (note && note.length > 2_000) throw new Error("Review note is too long.");

  return {
    proposalHash: value.proposalHash,
    decision: value.decision,
    criteria,
    note: note || null,
  };
}
