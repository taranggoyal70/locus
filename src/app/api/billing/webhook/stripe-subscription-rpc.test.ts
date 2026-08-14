import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type SubscriptionRow = {
  userId: string;
  customerId: string;
  subscriptionId: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "inactive" | "cancelled";
  lastEventId: string | null;
  lastEventCreatedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

type WriteResult = { applied: boolean };

const migrationSql = readFileSync(
  new URL("../../../../../supabase/migrations/017_stripe_event_ordering.sql", import.meta.url),
  "utf8",
);

const baseRow: SubscriptionRow = {
  userId: "user_123",
  customerId: "cus_123",
  subscriptionId: "sub_old",
  plan: "free",
  status: "cancelled",
  lastEventId: "evt_deleted",
  lastEventCreatedAt: Date.parse("2026-01-01T12:00:00Z"),
  createdAt: Date.parse("2025-12-01T12:00:00Z"),
  updatedAt: Date.parse("2026-01-01T12:00:00Z"),
};

function normalize(sql: string) {
  return sql.toLowerCase().replaceAll(/\s+/g, " ").trim();
}

function extractBetween(sql: string, start: string, end: string) {
  const normalized = normalize(sql);
  const startIndex = normalized.indexOf(start);
  const endIndex = normalized.indexOf(end, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error(`Could not parse migration section from ${start} to ${end}`);
  }
  return normalized.slice(startIndex, endIndex);
}

function compileMigration(sql: string) {
  const statements = normalize(sql).split(";").map((statement) => statement.trim());
  const backfillsNullWatermark = statements.some((statement) =>
    statement.startsWith("update public.subscriptions")
    && statement.includes("set last_event_created_at = coalesce(updated_at, created_at)")
    && statement.includes("where last_event_created_at is null")
  );
  const upsertConflict = extractBetween(sql, "on conflict (user_id) do update", "get diagnostics");
  const applyUpdate = extractBetween(sql, "update public.subscriptions set status", "get diagnostics");

  const canAdvance = (guardSql: string, row: SubscriptionRow, eventCreatedAt: number) => {
    if (row.lastEventCreatedAt === null) {
      return guardSql.includes("last_event_created_at is null");
    }
    if (guardSql.includes("last_event_created_at <= ")) {
      return row.lastEventCreatedAt <= eventCreatedAt;
    }
    if (guardSql.includes("last_event_created_at < ")) {
      return row.lastEventCreatedAt < eventCreatedAt;
    }
    return false;
  };

  return {
    migrate(rows: SubscriptionRow[]) {
      if (!backfillsNullWatermark) return;
      for (const row of rows) {
        if (row.lastEventCreatedAt === null) {
          row.lastEventCreatedAt = row.updatedAt ?? row.createdAt;
        }
      }
    },
    applyStripeSubscriptionEvent(
      rows: SubscriptionRow[],
      subscriptionId: string,
      status: SubscriptionRow["status"],
      plan: SubscriptionRow["plan"] | null,
      eventId: string,
      eventCreatedAt: number,
    ): WriteResult {
      const row = rows.find((candidate) => candidate.subscriptionId === subscriptionId);
      const terminalCancellation = applyUpdate.includes("(status <> 'cancelled' or p_status = 'cancelled')");
      if (
        !row
        || row.lastEventId === eventId
        || !canAdvance(applyUpdate, row, eventCreatedAt)
        || (terminalCancellation && row.status === "cancelled" && status !== "cancelled")
      ) {
        return { applied: false };
      }

      row.status = status;
      row.plan = plan ?? row.plan;
      row.lastEventId = eventId;
      row.lastEventCreatedAt = eventCreatedAt;
      return { applied: true };
    },
    upsertStripeSubscription(
      rows: SubscriptionRow[],
      userId: string,
      customerId: string,
      subscriptionId: string,
      plan: SubscriptionRow["plan"],
      status: SubscriptionRow["status"],
      eventId: string,
      eventCreatedAt: number,
    ): WriteResult {
      const row = rows.find((candidate) => candidate.userId === userId);
      if (!row) {
        rows.push({
          userId,
          customerId,
          subscriptionId,
          plan,
          status,
          lastEventId: eventId,
          lastEventCreatedAt: eventCreatedAt,
          createdAt: eventCreatedAt,
          updatedAt: eventCreatedAt,
        });
        return { applied: true };
      }

      if (row.lastEventId === eventId || !canAdvance(upsertConflict, row, eventCreatedAt)) {
        return { applied: false };
      }

      row.customerId = customerId;
      row.subscriptionId = subscriptionId;
      row.plan = plan;
      row.status = status;
      row.lastEventId = eventId;
      row.lastEventCreatedAt = eventCreatedAt;
      return { applied: true };
    },
  };
}

describe("Stripe subscription RPC ordering contract", () => {
  const rpc = compileMigration(migrationSql);

  it("backfills legacy null watermarks and refuses a stale active event", () => {
    const rows = [{ ...baseRow, lastEventId: null, lastEventCreatedAt: null }];

    rpc.migrate(rows);
    const result = rpc.applyStripeSubscriptionEvent(
      rows,
      "sub_old",
      "active",
      null,
      "evt_stale_active",
      Date.parse("2020-01-01T00:00:00Z"),
    );

    expect(result.applied).toBe(false);
    expect(rows[0].lastEventCreatedAt).toBe(baseRow.updatedAt);
    expect(rows[0]).toMatchObject({ plan: "free", status: "cancelled" });
  });

  it("refuses an equal-second active event after cancellation", () => {
    const rows = [{ ...baseRow }];

    const result = rpc.applyStripeSubscriptionEvent(
      rows,
      "sub_old",
      "active",
      null,
      "evt_same_second_active",
      baseRow.lastEventCreatedAt!,
    );

    expect(result.applied).toBe(false);
    expect(rows[0]).toMatchObject({ plan: "free", status: "cancelled" });
  });

  it("refuses reactivation through apply_stripe_subscription_event", () => {
    const rows = [{ ...baseRow }];

    const result = rpc.applyStripeSubscriptionEvent(
      rows,
      "sub_old",
      "active",
      null,
      "evt_later_active",
      Date.parse("2026-01-01T12:00:01Z"),
    );

    expect(result.applied).toBe(false);
    expect(rows[0]).toMatchObject({ plan: "free", status: "cancelled" });
  });

  it("applies a genuinely newer non-terminal update", () => {
    const rows = [{ ...baseRow, plan: "pro", status: "active" as const }];

    const result = rpc.applyStripeSubscriptionEvent(
      rows,
      "sub_old",
      "inactive",
      null,
      "evt_later_inactive",
      Date.parse("2026-01-01T12:00:01Z"),
    );

    expect(result.applied).toBe(true);
    expect(rows[0]).toMatchObject({ plan: "pro", status: "inactive" });
  });

  it("reactivates a cancelled user through subscription upsert", () => {
    const rows = [{ ...baseRow }];

    const result = rpc.upsertStripeSubscription(
      rows,
      "user_123",
      "cus_new",
      "sub_new",
      "pro",
      "active",
      "evt_checkout_new",
      Date.parse("2026-01-01T12:00:01Z"),
    );

    expect(result.applied).toBe(true);
    expect(rows[0]).toMatchObject({
      customerId: "cus_new",
      subscriptionId: "sub_new",
      plan: "pro",
      status: "active",
    });
  });

  it("fails closed when an unexpected null watermark reaches the RPC", () => {
    const rows = [{ ...baseRow, lastEventCreatedAt: null }];

    const result = rpc.applyStripeSubscriptionEvent(
      rows,
      "sub_old",
      "active",
      null,
      "evt_active",
      Date.parse("2026-01-01T12:00:01Z"),
    );

    expect(result.applied).toBe(false);
    expect(rows[0]).toMatchObject({ plan: "free", status: "cancelled" });
  });
});
