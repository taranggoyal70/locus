import { beforeEach, describe, expect, it, vi } from "vitest";

// R17: this route grants and revokes paid access and had no tests at all.
//
// The property under test is not "does a duplicate event write twice" — every
// handler here is a last-write-wins write, so it does not. It is that a stale
// event cannot undo a newer one. Stripe does not guarantee delivery order, so a
// delayed `customer.subscription.updated` carrying `status: active` can arrive
// after `customer.subscription.deleted` and restore access to a cancelled
// account. The ordering guard lives in migration 017; these tests pin the
// contract this route relies on it for.

const constructEventMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

vi.mock("@/lib/supabase-tenant", () => ({
  globalClient: () => ({ rpc: rpcMock }),
}));

const { POST } = await import("@/app/api/billing/webhook/route");

// 2026-01-01T12:00:00Z as Stripe delivers it: unix seconds.
const EVENT_CREATED_SECONDS = 1_767_268_800;
const EVENT_CREATED_ISO = new Date(EVENT_CREATED_SECONDS * 1_000).toISOString();

function webhookRequest(body = "{}", headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef", ...headers },
    body,
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  constructEventMock.mockReset();
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [{ applied: true, skipped_reason: null }], error: null });
});

describe("Stripe subscription webhook", () => {
  it("rejects a request carrying no signature", async () => {
    const response = await POST(webhookRequest("{}", { "stripe-signature": "" }));

    expect(response.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a body whose signature does not verify", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("no match for signature");
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    // Nothing reaches the database on an unverified body.
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("refuses to run without a configured webhook secret", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("grants access on checkout completion, carrying the event identity", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_checkout",
      created: EVENT_CREATED_SECONDS,
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { userId: "user_paying" },
          subscription: "sub_123",
          customer: "cus_123",
        },
      },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("upsert_stripe_subscription", {
      p_user_id: "user_paying",
      p_customer_id: "cus_123",
      p_subscription_id: "sub_123",
      p_plan: "pro",
      p_status: "active",
      p_event_id: "evt_checkout",
      p_event_created: EVENT_CREATED_ISO,
    });
  });

  it("cancels through the guarded write rather than a bare update", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_deleted",
      created: EVENT_CREATED_SECONDS,
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123", status: "canceled" } },
    });

    await POST(webhookRequest());

    expect(rpcMock).toHaveBeenCalledWith("apply_stripe_subscription_event", {
      p_subscription_id: "sub_123",
      p_status: "cancelled",
      p_plan: "free",
      p_event_id: "evt_deleted",
      p_event_created: EVENT_CREATED_ISO,
    });
  });

  it("leaves the plan alone on a status update", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_updated",
      created: EVENT_CREATED_SECONDS,
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", status: "past_due" } },
    });

    await POST(webhookRequest());

    // A non-active status must not be read as a downgrade to the free plan: this
    // event does not carry the plan, so guessing it would revoke paid features on
    // a recoverable payment failure.
    expect(rpcMock).toHaveBeenCalledWith("apply_stripe_subscription_event", expect.objectContaining({
      p_status: "inactive",
      p_plan: null,
    }));
  });

  it("passes the event timestamp so the database can refuse a stale event", async () => {
    // The ordering guard is only as good as the watermark it is given. If the
    // route sent its own clock instead of `event.created`, a stale event would
    // look current and overwrite newer state.
    const older = EVENT_CREATED_SECONDS - 3_600;
    constructEventMock.mockReturnValue({
      id: "evt_stale",
      created: older,
      type: "customer.subscription.updated",
      data: { object: { id: "sub_123", status: "active" } },
    });

    await POST(webhookRequest());

    const [, args] = rpcMock.mock.calls[0];
    expect(args.p_event_created).toBe(new Date(older * 1_000).toISOString());
    expect(args.p_event_created).not.toBe(EVENT_CREATED_ISO);
  });

  it("acknowledges an event the database refused as stale", async () => {
    // A refusal is correct handling, not a failure. Returning non-2xx would make
    // Stripe retry a stale event indefinitely.
    rpcMock.mockResolvedValue({
      data: [{ applied: false, skipped_reason: "stale-duplicate-or-unknown" }],
      error: null,
    });
    constructEventMock.mockReturnValue({
      id: "evt_stale",
      created: EVENT_CREATED_SECONDS,
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_123" } },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
  });

  it("ignores a checkout session with no user to attribute it to", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_anon",
      created: EVENT_CREATED_SECONDS,
      type: "checkout.session.completed",
      data: { object: { metadata: {}, subscription: "sub_123", customer: "cus_123" } },
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(200);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("bounds the body before reading it", async () => {
    const oversized = "x".repeat(256 * 1024 + 1);

    const response = await POST(webhookRequest(oversized));

    expect(response.status).toBe(413);
    // The ceiling has to sit in front of the read, so nothing is verified either.
    expect(constructEventMock).not.toHaveBeenCalled();
  });
});
