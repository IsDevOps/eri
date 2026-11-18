import { Pool, type QueryResultRow } from "pg";

const globalForPg = globalThis as unknown as { __eriPool?: Pool };

export const pool: Pool =
  globalForPg.__eriPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/eri",
    max: 10,
  });
if (process.env.NODE_ENV !== "production") globalForPg.__eriPool = pool;

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
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
