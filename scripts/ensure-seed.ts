/** Docker entrypoint helper: exit 0 if the DB already has data, 10 if it needs seeding. */
import { pool } from "../src/lib/db";

async function main() {
  const t = await pool.query("select to_regclass('public.lga') as t");
  let seeded = false;
  const u = await pool.query("select to_regclass('public.app_user') as t");
  if (t.rows[0].t && u.rows[0].t) seeded = Number((await pool.query("select count(*) from polling_unit")).rows[0].count) > 0;
  await pool.end();
  process.exit(seeded ? 0 : 10);
}
main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
