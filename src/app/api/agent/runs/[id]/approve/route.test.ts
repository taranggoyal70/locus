import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/agent/runs/[id]/approve/route";

describe("controlled-alpha Run delivery", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
    // The capability check is mocked file-wide so the R10 tests below can reach
    // the delivery path at all. This restates the shipped default; that delivery
    // is genuinely unreleased is asserted against the real record in
    // admission.test.ts.
    deliveryAllowedMock.mockReturnValue(false);
  });

  it("cannot approve an external GitHub write", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/runs/run-id/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub delivery is disabled during early access.",
    });
  });
});

// R10: delivery must name the artifact it delivers. This endpoint previously
// required only that the Run was awaiting approval, so it approved "whatever
// proposal is current" rather than the one a human read, making it a second
// approval path alongside /review that was not bound to a proposal hash.
const deliveryAllowedMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admission-server", () => ({
  accountCan: (_userId: string | null, capability: string) =>
    Promise.resolve(capability === "delivery" ? deliveryAllowedMock() : false),
}));

const tenantClientMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-tenant", () => ({
  tenantClient: tenantClientMock,
  globalClient: vi.fn(),
}));

const RUN_ID = "00000000-0000-4000-8000-000000000001";
const STORED_HASH = "a".repeat(64);

function approvalRequest(body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/agent/runs/${RUN_ID}/approve`, {
    method: "POST",
    // A same-origin browser request, which is what these tests mean to exercise.
    // Sending no Origin and no Fetch Metadata is a shape a browser never produces
    // and the shared mutation guard rejects.
    headers: { "content-type": "application/json", origin: "http://localhost", ...headers },
    body: JSON.stringify(body ?? {}),
  });
}

function context() {
  return { params: Promise.resolve({ id: RUN_ID }) };
}

describe("delivery is bound to the reviewed proposal", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    deliveryAllowedMock.mockReturnValue(true);
    // Any query resolves to a Run awaiting approval carrying STORED_HASH.
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "update", "insert", "single"]) {
      builder[method] = () => builder;
    }
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve({ data: { id: RUN_ID, proposal_hash: STORED_HASH }, error: null }));
    tenantClientMock.mockReturnValue({ from: () => builder });
  });

  it("refuses an approval that names no proposal", async () => {
    const response = await POST(approvalRequest(), context());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("proposalHash"),
    });
  });

  it.each([" ", "not-a-hash", "b".repeat(63), "B".repeat(64), 12345])(
    "refuses a malformed proposal hash: %s",
    async (proposalHash) => {
      const response = await POST(approvalRequest({ proposalHash }), context());

      expect(response.status).toBe(400);
    },
  );

  it("refuses a hash that does not match the Run's current proposal", async () => {
    const response = await POST(approvalRequest({ proposalHash: "c".repeat(64) }), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("changed since it was reviewed"),
    });
  });
});

describe("delivery rejects requests a browser would not have made", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    deliveryAllowedMock.mockReturnValue(true);
  });

  it("rejects a cross-site request", async () => {
    const response = await POST(approvalRequest({}, { "sec-fetch-site": "cross-site" }), context());

    expect(response.status).toBe(403);
  });

  it("rejects a same-site request from a sibling origin", async () => {
    // The inline `sec-fetch-site === "cross-site"` check this route used allowed
    // `same-site`, so a sibling subdomain could drive the delivery endpoint with
    // the user's cookies. Every other mutation route already used the shared
    // guard, which rejects this.
    const response = await POST(approvalRequest({}, { "sec-fetch-site": "same-site" }), context());

    expect(response.status).toBe(403);
  });

  it("rejects a request carrying no browser evidence at all", async () => {
    const bare = new Request(`http://localhost/api/agent/runs/${RUN_ID}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    // No Origin and no Fetch Metadata: the inline check allowed this too.
    const response = await POST(bare, context());

    expect(response.status).toBe(403);
  });

  it("rejects a request whose Origin is a different host", async () => {
    const response = await POST(approvalRequest({}, { origin: "http://attacker.example" }), context());

    expect(response.status).toBe(403);
  });
});
