import type {
  KyselyPlugin,
  OperationNode,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from "kysely";
import type { Kysely } from "kysely";

import { db } from "@/lib/db/client";
import { USER_SCOPED_TABLES, type Database } from "@/lib/db/schema";

// R7: the server connects as the database owner, which bypasses row-level
// security.
//
// Row-level security is enabled on every table and the API roles are revoked, so
// the database is well defended against any client but the server. What it cannot
// defend against is the server itself: a query carries no tenant identity, so a
// single missing `where user_id = …` silently returns another customer's rows.
// Every server-side authorization mistake is a cross-tenant event by default.
//
// This module removes that default. A query against a user-scoped table that does
// not constrain itself to the caller fails closed instead of over-returning, and
// the constraint must name the *authenticated* user rather than any user id that
// happened to be in scope, which also catches the wrong-variable class of IDOR
// bug. The check reads the compiled query, so it cannot be bypassed by building
// the same SQL a different way through the query builder.
//
// Queries that legitimately span tenants (the Stripe webhook, the retention cron,
// the run workflow resolving a run before it knows the owner) must say so
// explicitly through globalDb(), so the exceptions are enumerable.

const TENANT_COLUMN = "user_id";

/** Generated from the schema: every table with a user_id column is guarded. */
export const TENANT_TABLES: ReadonlySet<string> = new Set(USER_SCOPED_TABLES);

export class TenantScopeError extends Error {
  constructor(table: string) {
    super(
      `Query against tenant table "${table}" was not constrained to the authenticated user. `
        + `Add .where("${TENANT_COLUMN}", "=", userId), or use globalDb(reason) if it is genuinely cross-tenant.`,
    );
    this.name = "TenantScopeError";
  }
}

type Node = OperationNode & Record<string, unknown>;

function tableName(node: OperationNode | undefined): string | null {
  if (!node) return null;
  const current = node as Node;
  if (current.kind === "AliasNode") return tableName(current.node as OperationNode);
  if (current.kind !== "TableNode") return null;
  const identifier = (current.table as Node).identifier as Node;
  return String(identifier.name);
}

function columnName(node: OperationNode): string | null {
  const current = node as Node;
  if (current.kind === "ReferenceNode") return columnName(current.column as OperationNode);
  if (current.kind === "ColumnNode") return String((current.column as Node).name);
  return null;
}

/**
 * True when `where` is `user_id = <userId>`, alone or as one conjunct of a chain
 * of ANDs. A disjunction never qualifies: `user_id = me OR true` constrains
 * nothing.
 */
function constrainsToUser(where: OperationNode | undefined, userId: string): boolean {
  if (!where) return false;
  const node = where as Node;
  switch (node.kind) {
    case "WhereNode":
    case "ParensNode":
      return constrainsToUser((node.where ?? node.node) as OperationNode, userId);
    case "AndNode":
      return constrainsToUser(node.left as OperationNode, userId)
        || constrainsToUser(node.right as OperationNode, userId);
    case "BinaryOperationNode": {
      const operator = (node.operator as Node).operator;
      const right = node.rightOperand as Node;
      return operator === "="
        && columnName(node.leftOperand as OperationNode) === TENANT_COLUMN
        && right.kind === "ValueNode"
        && right.value === userId;
    }
    default:
      return false;
  }
}

function insertBelongsToUser(node: Node, userId: string): boolean {
  const columns = (node.columns as Node[] | undefined) ?? [];
  const index = columns.findIndex((column) => String((column.column as Node).name) === TENANT_COLUMN);
  const values = node.values as Node | undefined;
  if (index === -1 || !values || values.kind !== "ValuesNode") return false;
  const rows = values.values as Node[];
  return rows.length > 0 && rows.every((row) => {
    if (row.kind === "PrimitiveValueListNode") return (row.values as unknown[])[index] === userId;
    if (row.kind === "ValueListNode") {
      const value = (row.values as Node[])[index];
      return value?.kind === "ValueNode" && value.value === userId;
    }
    return false;
  });
}

/** The user-scoped table a root query touches, if any, and whether it is scoped. */
export function checkTenantScope(node: RootOperationNode, userId: string): { table: string; scoped: boolean } | null {
  const query = node as unknown as Node;
  let tables: string[] = [];
  let scoped = false;
  switch (query.kind) {
    case "SelectQueryNode":
    case "DeleteQueryNode": {
      const from = query.from as Node | undefined;
      tables = ((from?.froms as OperationNode[] | undefined) ?? []).map(tableName).filter((name): name is string => !!name);
      if (query.joins) tables.push(...(query.joins as Node[]).map((join) => tableName(join.table as OperationNode)).filter((name): name is string => !!name));
      scoped = constrainsToUser(query.where as OperationNode | undefined, userId);
      break;
    }
    case "UpdateQueryNode": {
      const table = tableName(query.table as OperationNode | undefined);
      if (table) tables = [table];
      scoped = constrainsToUser(query.where as OperationNode | undefined, userId);
      break;
    }
    case "InsertQueryNode": {
      const table = tableName(query.into as OperationNode | undefined);
      if (table) tables = [table];
      scoped = insertBelongsToUser(query, userId);
      break;
    }
    default:
      // Raw SQL (a SQL function call) carries its owner as an explicit argument
      // and is checked by the function itself.
      return null;
  }
  const guarded = tables.find((table) => TENANT_TABLES.has(table));
  if (!guarded) return null;
  // A join brings a second table's rows into reach, and a single user_id
  // predicate cannot say which table it constrains, so joins across
  // user-scoped tables are refused outright.
  if (tables.length > 1) return { table: guarded, scoped: false };
  return { table: guarded, scoped };
}

class TenantScopePlugin implements KyselyPlugin {
  constructor(private readonly userId: string) {}

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    const verdict = checkTenantScope(args.node, this.userId);
    if (verdict && !verdict.scoped) throw new TenantScopeError(verdict.table);
    return args.node;
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }
}

/**
 * Database access that refuses to run an unscoped query against a user-scoped
 * table. Use this in any route that has an authenticated user.
 */
export function tenantDb(userId: string, database: Kysely<Database> = db()): Kysely<Database> {
  if (!userId) throw new Error("tenantDb requires an authenticated user id");
  return database.withPlugin(new TenantScopePlugin(userId));
}

/**
 * Unguarded access, for work that genuinely spans tenants.
 *
 * The `reason` is required so every exception is self-documenting and greppable;
 * the set of legitimate cross-tenant operations should stay small and reviewable.
 */
export function globalDb(reason: string, database: Kysely<Database> = db()): Kysely<Database> {
  if (!reason.trim()) throw new Error("globalDb requires a reason");
  return database;
}
