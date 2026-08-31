import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { serviceClient } from "@/lib/supabase";

// R7: the service role bypasses RLS.
//
// Row-level security is enabled on every table and the browser roles are
// revoked, so the database itself is well defended against the client. What it
// cannot defend against is the server: a service-role query carries no tenant
// identity, so a single missing `.eq("user_id", …)` silently returns another
// customer's rows. Every server-side authorization mistake is a cross-tenant
// event by default.
//
// This module removes that default. A tenant-scoped query that does not
// constrain itself to the caller fails closed instead of over-returning, and
// the constraint must name the *authenticated* user rather than any user id
// that happened to be in scope — which also catches the wrong-variable class of
// IDOR bug.
//
// Queries that legitimately span tenants — the Stripe webhook, the retention
// cron, the run workflow resolving a run before it knows the owner — must say
// so explicitly through globalClient(), so the exceptions are enumerable.

const TENANT_COLUMN = "user_id";

// Tables carrying a user_id column. Derived from database.types.ts; teams,
// waitlist, and agent_provider_leases have no per-user column and are excluded.
export const TENANT_TABLES: ReadonlySet<string> = new Set([
  "account_admissions",
  "agent_approvals",
  "agent_artifacts",
  "agent_provider_credentials",
  "agent_reviews",
  "agent_runs",
  "agent_steps",
  "agent_tasks",
  "api_keys",
  "events",
  "github_connections",
  "projects",
  "subscriptions",
  "team_members",
]);

export class TenantScopeError extends Error {
  constructor(table: string) {
    super(
      `Query against tenant table "${table}" was not constrained to the authenticated user. `
        + `Add .eq("${TENANT_COLUMN}", userId), or use globalClient(reason) if it is genuinely cross-tenant.`,
    );
    this.name = "TenantScopeError";
  }
}

type ScopeState = { table: string; satisfied: boolean };

function payloadIsScoped(payload: unknown, userId: string): boolean {
  if (Array.isArray(payload)) {
    return payload.length > 0 && payload.every((row) => payloadIsScoped(row, userId));
  }
  if (!payload || typeof payload !== "object") return false;
  return (payload as Record<string, unknown>)[TENANT_COLUMN] === userId;
}

// The builder is chainable and thenable. Every method that returns another
// builder is re-wrapped so the scope flag follows the whole chain, and `then`
// is where the decision is enforced — the last moment before the query runs.
function guardBuilder<T extends object>(builder: T, state: ScopeState, userId: string): T {
  return new Proxy(builder, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (property === "then") {
        if (!state.satisfied) {
          // Reject rather than throw synchronously, so the failure surfaces as
          // a normal rejected query and route error handling still applies.
          return (_resolve?: unknown, reject?: (reason: unknown) => unknown) => {
            const error = new TenantScopeError(state.table);
            if (typeof reject === "function") return Promise.resolve(reject(error));
            return Promise.reject(error);
          };
        }
        return typeof value === "function" ? value.bind(target) : value;
      }

      if (typeof value !== "function") return value;

      return (...args: unknown[]) => {
        // A filter only counts when it names the authenticated user. Filtering
        // on some other id is exactly the bug this is meant to catch.
        if (property === "eq" && args[0] === TENANT_COLUMN && args[1] === userId) {
          state.satisfied = true;
        }
        if ((property === "insert" || property === "upsert") && payloadIsScoped(args[0], userId)) {
          state.satisfied = true;
        }
        const result = (value as (...callArgs: unknown[]) => unknown).apply(target, args);
        return result && typeof result === "object"
          ? guardBuilder(result as object, state, userId)
          : result;
      };
    },
  });
}

/**
 * A service-role client that refuses to run an unscoped query against a
 * tenant-owned table. Use this in any route that has an authenticated user.
 */
export function tenantClient(userId: string): SupabaseClient<Database> {
  if (!userId) throw new Error("tenantClient requires an authenticated user id");
  const client = serviceClient();

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property !== "from") return Reflect.get(target, property, receiver);
      return (table: string) => {
        const builder = target.from(table as never);
        // Tables with no per-user column cannot be tenant-filtered, so guarding
        // them would only produce false failures.
        if (!TENANT_TABLES.has(table)) return builder;
        return guardBuilder(builder as object, { table, satisfied: false }, userId);
      };
    },
  }) as SupabaseClient<Database>;
}

/**
 * Unguarded service-role access, for work that genuinely spans tenants.
 *
 * The `reason` is required so every exception is self-documenting and greppable
 * — the set of legitimate cross-tenant operations should stay small and
 * reviewable.
 */
export function globalClient(reason: string): SupabaseClient<Database> {
  if (!reason.trim()) throw new Error("globalClient requires a reason");
  return serviceClient();
}
