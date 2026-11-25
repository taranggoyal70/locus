// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnpublishedChange } from "@/components/UnpublishedChange";
import { ProposalPatch, patchCommands } from "@/components/ProposalPatch";
import { ProposalReview } from "@/components/ProposalReview";
import type { AgentRunSnapshot } from "@/lib/agent/run-view";

const RUN_ID = "0123abcd-0000-4000-8000-000000000001";
const PROPOSAL_HASH = "b".repeat(64);
const BASE = "c".repeat(40);
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function review(onDecided = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ProposalReview
      runId={RUN_ID}
      proposalHash={PROPOSAL_HASH}
      acceptanceCriteria={["Keeps the query", "Tests pass"]}
      onDecided={onDecided}
    />,
  );
  return onDecided;
}

function snapshot(
  status: AgentRunSnapshot["run"]["status"],
  decision?: "accepted" | "rejected",
): AgentRunSnapshot {
  return {
    run: {
      id: RUN_ID, status, error: null, failure_kind: null, proposal_hash: PROPOSAL_HASH,
      token_budget: 1, included_files: [], excluded_files: [], widened_files: [],
    },
    steps: [],
    artifacts: [{ id: "d", kind: "diff", label: "", content: "x", url: null, base_revision: BASE }],
    reviews: decision
      ? [{ id: "r", proposal_hash: PROPOSAL_HASH, decision, criterion_decisions: [], note: null, created_at: "" }]
      : [],
    tokens: {
      baselineTokens: 0, includedContextTokens: 0, inputTokens: 0,
      cachedInputTokens: 0, outputTokens: 0, totalTokens: 0,
    },
  };
}

describe("ProposalReview", () => {
  it("accepts only when every criterion is satisfied, and sends exactly what was decided", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: "completed" }) });
    const onDecided = review();
    const accept = screen.getByText<HTMLButtonElement>("Accept criteria");

    fireEvent.click(screen.getByLabelText("Keeps the query"));
    expect(accept.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Tests pass"));
    fireEvent.change(screen.getByLabelText("Evidence for Tests pass"), { target: { value: "pnpm test" } });
    expect(accept.disabled).toBe(false);
    fireEvent.click(accept);

    await waitFor(() => expect(onDecided).toHaveBeenCalledOnce());
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/agent/runs/${RUN_ID}/review`);
    expect(JSON.parse(request.body)).toEqual({
      proposalHash: PROPOSAL_HASH,
      decision: "accepted",
      criteria: [
        { criterion: "Keeps the query", satisfied: true },
        { criterion: "Tests pass", satisfied: true, evidence: "pnpm test" },
      ],
    });
  });

  it("can reject without satisfying anything, and shows a refusal from the server", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "The proposal changed." }) });
    const onDecided = review();

    fireEvent.click(screen.getByText("Reject proposal"));

    expect((await screen.findByRole("alert")).textContent).toContain("The proposal changed.");
    expect(onDecided).not.toHaveBeenCalled();
  });
});

describe("ProposalPatch", () => {
  it("offers an unreviewed proposal as something to try, not as an accepted change", () => {
    const { container } = render(<ProposalPatch snapshot={snapshot("awaiting_approval")} />);
    expect(container.textContent).toContain("It is not reviewed yet");
    expect(container.textContent).not.toContain("Accepted change");
  });

  it("offers an accepted change with commands from the commit the Run read", () => {
    const { container } = render(<ProposalPatch snapshot={snapshot("completed", "accepted")} />);
    expect(container.textContent).toContain("Accepted change");
    expect(container.textContent).toContain(patchCommands(RUN_ID, BASE));
    expect(patchCommands(RUN_ID, BASE)).toBe(
      "git switch -c locus/0123abcd cccccccccccc\ngit apply --index ~/Downloads/locus-0123abcd.patch",
    );
  });

  it.each([
    ["rejected", snapshot("rejected", "rejected")],
    ["still executing", snapshot("executing")],
    ["failed", snapshot("failed")],
  ])("renders nothing for a Run that is %s", (_name, value) => {
    expect(render(<ProposalPatch snapshot={value} />).container.innerHTML).toBe("");
  });

  it("shows a failed Run's work and check output, with nothing to accept", () => {
    const value = snapshot("failed");
    value.run.proposal_hash = null;
    value.artifacts.push({ id: "t", kind: "test", label: "", content: "npm test exit 1", url: null });
    const { container } = render(<UnpublishedChange snapshot={value} />);
    expect(container.textContent).toContain("cannot be accepted or downloaded");
    expect(container.textContent).toContain("npm test exit 1");
    expect(container.querySelector("button")).toBeNull();
    expect(render(<UnpublishedChange snapshot={snapshot("awaiting_approval")} />).container.innerHTML).toBe("");
  });

  it("says why a Run from before proposals were hashed cannot be decided", () => {
    const value = snapshot("awaiting_approval");
    value.run.proposal_hash = null;
    const { container } = render(<ProposalPatch snapshot={value} />);
    expect(container.textContent).toContain("cannot be accepted or downloaded");
    expect(container.querySelector("button")).toBeNull();
  });

  it("downloads the patch from the Run's own route", async () => {
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(["patch"]) });
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined }));
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click(this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    render(<ProposalPatch snapshot={snapshot("completed", "accepted")} />);

    fireEvent.click(screen.getByText("Download patch"));

    await waitFor(() => expect(downloaded).toBe("locus-0123abcd.patch"));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/agent/runs/${RUN_ID}/patch`);
  });

  it("says why a patch could not be produced", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Failed its integrity check." }) });
    render(<ProposalPatch snapshot={snapshot("completed", "accepted")} />);

    fireEvent.click(screen.getByText("Download patch"));

    expect((await screen.findByRole("alert")).textContent).toContain("Failed its integrity check.");
  });
});
