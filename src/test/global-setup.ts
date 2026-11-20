import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { TestProject } from "vitest/node";

import { migrate } from "../../db/migrate.mjs";

declare module "vitest" {
  export interface ProvidedContext {
    databaseTemplate: string;
  }
}

// Replaying the migration chain takes about two seconds. Doing it once and
// cloning the result into each test file keeps a real PostgreSQL behind every
// database test without paying that per file.
export default async function setup(project: TestProject) {
  const database = await PGlite.create({ extensions: { pgcrypto } });
  await migrate(database);
  const dump = await database.dumpDataDir("none");
  await database.close();

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-test-db-"));
  const file = path.join(directory, "template.tar");
  fs.writeFileSync(file, Buffer.from(await dump.arrayBuffer()));
  project.provide("databaseTemplate", file);

  return () => fs.rmSync(directory, { recursive: true, force: true });
}
