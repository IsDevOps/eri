import { loadEnvConfig } from "@next/env";
import { Pool, type QueryResultRow } from "pg";

// Load .env.local for standalone scripts as well as Next.js.
loadEnvConfig(process.cwd());

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Check your .env.local file.");
}

const globalForPg = globalThis as unknown as {
  __eriPool?: Pool;
};

export const pool: Pool =
  globalForPg.__eriPool ??
  new Pool({
    connectionString: DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.__eriPool = pool;
}

/** In production a missing DATABASE_URL must fail loudly, not silently fall back to localhost (a common hosting mistake). */
export const dbUrlMissing = () => process.env.NODE_ENV === "production" && !process.env.DATABASE_URL;

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (dbUrlMissing()) throw new Error("DATABASE_URL is not set. Add it to the host's environment variables (see README → Deploy).");
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}