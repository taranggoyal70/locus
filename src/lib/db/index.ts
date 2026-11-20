export { db, databaseConfigured, DatabaseNotConfiguredError } from "@/lib/db/client";
export { databaseErrorCode } from "@/lib/db/errors";
export { jsonb } from "@/lib/db/json";
export { rpc } from "@/lib/db/rpc";
export type { Database, Functions, Json } from "@/lib/db/schema";
export { globalDb, TENANT_TABLES, TenantScopeError, tenantDb } from "@/lib/db/tenant";
