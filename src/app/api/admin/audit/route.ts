import { guard } from "@/lib/auth";
import { q } from "@/lib/db";
import { json } from "@/lib/http";

export const GET = guard(["admin"], async () => json(await q("select id, event, detail, created_at from audit_log order by id desc limit 40")));
