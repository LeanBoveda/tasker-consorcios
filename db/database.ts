import { env } from "cloudflare:workers";

export function getDatabase(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

/**
 * Keep the existing store contract without modifying the schema at request time.
 * Drizzle migrations are the only source of truth for tables and indexes.
 */
export async function ensureDatabase() {
  getDatabase();
}
