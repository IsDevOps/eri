import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { q } from "@/lib/db";

async function handle() {
  const alerts = await q(
    `select a.id, a.kind, a.severity, a.level, a.message, a.detail, a.created_at,
            w.number as ward, p.code as pu,
            (select count(*) from outbox o where o.alert_id = a.id) as notified
       from alert a
       left join ward w on w.id = a.ward_id
       left join polling_unit p on p.id = a.pu_id
      order by a.id desc limit 50`,
  );
  return json(alerts);
}

export const GET = guard(["admin", "observer"], () => handle());
