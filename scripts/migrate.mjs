#!/usr/bin/env node
/**
 * Apply Drizzle SQL migrations (no drizzle-kit in the production image).
 * Used by docker-entrypoint.sh on container start.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const root = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(root, "..", "drizzle");

const client = postgres(url, { max: 1 });
try {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder });
  console.log("Migrations applied:", migrationsFolder);
} finally {
  await client.end({ timeout: 5 });
}
