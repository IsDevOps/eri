import { json } from "@/lib/http";
import { q1 } from "@/lib/db";

export async function GET() {
  const s = await q1(
    `select (select count(*) from polling_unit) as pus,
            (select count(distinct pu_id) from submission) as witnessed,
            (select count(*) from submission) as submissions,
            (select count(*) from alert) as alerts,
            (select count(*) from outbox) as messages`,
  );
  return json(s);
}
