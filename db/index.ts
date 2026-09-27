import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

type Sql = ReturnType<typeof postgres>;

/**
 * Lazy client so Next.js can import schema/types without requiring DATABASE_URL
 * at build time. Runtime routes must set DATABASE_URL.
 */
function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to connect to Postgres");
  }

  const client = postgres(url, { max: 10 });
  return { db: drizzle(client, { schema }), client };
}

export type Db = ReturnType<typeof createDb>["db"];

const globalForDb = globalThis as unknown as {
  __familyCirclesDb?: Db;
  __familyCirclesSql?: Sql;
};

export function getDb(): Db {
  if (!globalForDb.__familyCirclesDb) {
    const { db, client } = createDb();
    globalForDb.__familyCirclesDb = db;
    globalForDb.__familyCirclesSql = client;
  }
  return globalForDb.__familyCirclesDb;
}

/** Close the pooled client (scripts / tests). */
export async function closeDb() {
  if (globalForDb.__familyCirclesSql) {
    await globalForDb.__familyCirclesSql.end({ timeout: 5 });
    globalForDb.__familyCirclesSql = undefined;
    globalForDb.__familyCirclesDb = undefined;
  }
}

export * from "./schema";
