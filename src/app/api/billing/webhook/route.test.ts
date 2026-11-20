import { sql } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "@/test/database";

// R17: this route grants and revokes paid access.
//
// The property under test is not "does a duplicate event write twice": every
// handler here is a last-write-wins write, so it does not. It is that a stale
// event cannot undo a newer one. Stripe does not guarantee delivery order, so a
// delayed `customer.subscription.updated` carrying `status: active` can arrive
// after `customer.subscription.deleted` and restore access to a cancelled
// account. The ordering guard lives in migration 017, and these tests run the
// route against it on a real migrated database.

const constructEventMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ webhooks: { constructEvent: constructEventMock } }),
}));

const { POST } = await import("@/app/api/billing/webhook/route");

const database = setupTestDatabase();

// 2026-01-01T12:00:00Z as Stripe delivers it: unix seconds.
const T = 1_767_268_800;
const HOUR = 3_600;

type StripeEvent = { id: string; created: number; type: string; data: { object: Record<string, unknown> } };

function checkout(id: string, created: number, metadata: Record<string, string> = { userId: "user_paying" }): StripeEvent {
  return {
    id,
    created,
    type: "checkout.session.completed",
    data: { object: { metadata, subscription: "sub_123", customer: "cus_123" } },
  };
}

function updated(id: string, created: number, status: string): StripeEvent {
  return { id, created, type: "customer.subscription.updated", data: { object: { id: "sub_123", status } } };
}

function deleted(id: string, created: number): StripeEvent {
  return { id, created, type: "customer.subscription.deleted", data: { object: { id: "sub_123", status: "canceled" } } };
}

function webhookRequest(body = "{}", headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=deadbeef", ...headers },
    body,
  });
}

async function deliver(event: StripeEvent) {
  constructEventMock.mockReturnValueOnce(event);
  return POST(webhookRequest());
}

async function subscriptions() {
  return database().selectFrom("subscriptions")
    .select(["user_id", "stripe_customer_id", "stripe_subscription_id", "plan", "status", "last_event_id", "last_event_created_at"])
    .execute();
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  constructEventMock.mockReset();
});

describe("Stripe subscription webhook", () => {
  it("rejects a request carrying no signature", async () => {
    const response = await POST(webhookRequest("{}", { "stripe-signature": "" }));

    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("rejects a body whose signature does not verify", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("no match for signature");
    });

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    // Nothing reaches the database on an unverified body.
    expect(await subscriptions()).toEqual([]);
  });

  it("refuses to run without a configured webhook secret", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

    const response = await POST(webhookRequest());

    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
  });

  it("grants access on checkout completion, carrying the event identity", async () => {
    const response = await deliver(checkout("evt_checkout", T));

    expect(response.status).toBe(200);
    expect(await subscriptions()).toEqual([{
      user_id: "user_paying",
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      plan: "pro",
      status: "active",
      last_event_id: "evt_checkout",
      last_event_created_at: new Date(T * 1_000).toISOString().replace("Z", "+00:00").replace(".000", ""),
    }]);
  });

  it("cancels the subscription and drops it to the free plan", async () => {
    await deliver(checkout("evt_checkout", T));

    const response = await deliver(deleted("evt_deleted", T + HOUR));

    expect(response.status).toBe(200);
    expect(await subscriptions()).toMatchObject([{ plan: "free", status: "cancelled", last_event_id: "evt_deleted" }]);
  });

  it("leaves the plan alone on a status update", async () => {
    // A non-active status must not be read as a downgrade to the free plan: this
    // event does not carry the plan, so guessing it would revoke paid features on
    // a recoverable payment failure.
    await deliver(checkout("evt_checkout", T));

    await deliver(updated("evt_updated", T + HOUR, "past_due"));

    expect(await subscriptions()).toMatchObject([{ plan: "pro", status: "inactive" }]);
  });

  it("does not let a delayed update restore a cancelled subscription", async () => {
    // The update was sent before the cancellation but delivered after it. A
    // refusal is correct handling, not a failure: returning non-2xx would make
    // Stripe retry a stale event indefinitely.
    await deliver(checkout("evt_checkout", T));
    await deliver(deleted("evt_deleted", T + 2 * HOUR));

    const response = await deliver(updated("evt_stale", T + HOUR, "active"));

    expect(response.status).toBe(200);
    expect(await subscriptions()).toMatchObject([{ plan: "free", status: "cancelled", last_event_id: "evt_deleted" }]);
  });

  it("acknowledges a redelivered event without applying it twice", async () => {
    await deliver(checkout("evt_checkout", T));
    await deliver(updated("evt_updated", T + HOUR, "past_due"));

    const response = await deliver(updated("evt_updated", T + HOUR, "past_due"));

    expect(response.status).toBe(200);
    expect(await subscriptions()).toMatchObject([{ status: "inactive", last_event_id: "evt_updated" }]);
  });

  it.each([
    ["checkout.session.completed", checkout("evt_unwritten", T)],
    ["customer.subscription.updated", updated("evt_unwritten", T, "active")],
    ["customer.subscription.deleted", deleted("evt_unwritten", T)],
  ])("asks Stripe to retry %s when the database write fails", async (_type, event) => {
    // A failed write is not a refusal. Acknowledging it would tell Stripe the
    // event was handled, so a paid checkout would never be granted and a
    // cancellation would never be applied. Every write is idempotent on the
    // event ID, so a retry is safe.
    await sql`drop table public.subscriptions cascade`.execute(database());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await deliver(event);

    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });

  it("ignores a checkout session with no user to attribute it to", async () => {
    const response = await deliver(checkout("evt_anon", T, {}));

    expect(response.status).toBe(200);
    expect(await subscriptions()).toEqual([]);
  });

  it("bounds the body before reading it", async () => {
    const oversized = "x".repeat(256 * 1024 + 1);

    const response = await POST(webhookRequest(oversized));

    expect(response.status).toBe(413);
    // The ceiling has to sit in front of the read, so nothing is verified either.
    expect(constructEventMock).not.toHaveBeenCalled();
  });
});
