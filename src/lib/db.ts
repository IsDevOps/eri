import { loadEnvConfig } from "@next/env";
import { Pool, type QueryResultRow } from "pg";

// Load .env.local for standalone scripts as well as Next.js.
loadEnvConfig(process.cwd());

const globalForPg = globalThis as unknown as {
  __eriPool?: Pool;
};

export const pool: Pool =
  globalForPg.__eriPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/eri",
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