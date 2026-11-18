import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { q } from "@/lib/db";

async function handle(req: Request) {
  const phone = new URL(req.url).searchParams.get("phone");
  const rows = phone
    ? await q("select id, channel, to_phone, lang, body, status, created_at from outbox where to_phone=$1 order by id desc limit 30", [phone.replace(/[^\d+]/g, "")])
    : await q("select id, channel, to_phone, lang, body, status, created_at from outbox order by id desc limit 50");
  return json(rows);
}

export const GET = guard(["admin"], (req) => handle(req));
