import { GUARD_RUN_RECEIPT_SCHEMA } from "./guard-runner.mjs";
import { canonicalJson, sha256 } from "./guard.mjs";

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function receiptBody(receipt) {
  return Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== "receiptHash"),
  );
}

export function verifyRunReceiptHash(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("Guard Run receipt must be a JSON object.");
  }
  if (receipt.schemaVersion !== GUARD_RUN_RECEIPT_SCHEMA) {
    throw new Error(`Unsupported Guard Run receipt schema: ${receipt.schemaVersion ?? "missing"}`);
  }
  if (!receipt.enforcement || receipt.enforcement.mode !== "contained-agent-run"
    || !["pass", "fail"].includes(receipt.enforcement.result)) {
    throw new Error("Guard Run receipt has invalid enforcement evidence.");
  }
  if (!receipt.candidate || !/^[a-f0-9]{64}$/.test(receipt.candidate.hash ?? "")
    || !Array.isArray(receipt.candidate.changedPaths)
    || !Array.isArray(receipt.candidate.records)) {
    throw new Error("Guard Run receipt has invalid candidate evidence.");
  }
  if (!Array.isArray(receipt.checks) || !Array.isArray(receipt.violations)) {
    throw new Error("Guard Run receipt has invalid Check or violation evidence.");
  }
  if (!receipt.review || !["pending", "accepted", "rejected"].includes(receipt.review.status)) {
    throw new Error("Guard Run receipt has invalid human Review state.");
  }
  if (receipt.enforcement.result === "pass"
    && (receipt.checks.length === 0 || receipt.checks.some((check) => check?.result !== "pass"))) {
    throw new Error("A passing Guard Run receipt requires at least one passing Check.");
  }
  const expected = sha256(canonicalJson(receiptBody(receipt)));
  if (receipt.receiptHash !== expected) {
    throw new Error("Guard Run receipt hash does not match its contents.");
  }
  return receipt;
}

export function addHumanReview(receipt, {
  decision,
  actor,
  criteria,
  note = null,
  decidedAt = new Date().toISOString(),
}) {
  verifyRunReceiptHash(receipt);
  if (receipt.review?.status !== "pending") {
    throw new Error("Guard Run receipt already has a human Review.");
  }
  if (!["accepted", "rejected"].includes(decision)) {
    throw new Error("Human Review decision must be accepted or rejected.");
  }
  if (decision === "accepted" && receipt.enforcement?.result !== "pass") {
    throw new Error("A failing Guard Run cannot receive an accepted Review.");
  }
  if (decision === "accepted"
    && (!Array.isArray(receipt.checks) || receipt.checks.length === 0
      || receipt.checks.some((check) => check?.result !== "pass"))) {
    throw new Error("An accepted Review requires at least one passing Check and no failed Checks.");
  }
  if (!Array.isArray(criteria) || criteria.length === 0) {
    throw new Error("Human Review requires at least one criterion.");
  }
  const review = {
    status: decision,
    proposalHash: receipt.receiptHash,
    decidedBy: requireText(actor, "Review actor"),
    decidedAt: requireText(decidedAt, "Review time"),
    criteria: criteria.map((criterion) => requireText(criterion, "Review criterion")),
    note: note === null ? null : requireText(note, "Review note"),
  };
  const body = { ...receiptBody(receipt), review };
  return { ...body, receiptHash: sha256(canonicalJson(body)) };
}
