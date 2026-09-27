import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

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
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __familyCirclesDb?: Db };

export function getDb(): Db {
  if (!globalForDb.__familyCirclesDb) {
    globalForDb.__familyCirclesDb = createDb();
  }
  return globalForDb.__familyCirclesDb;
}

export * from "./schema";
