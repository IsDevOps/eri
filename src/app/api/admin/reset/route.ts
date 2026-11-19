import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { q } from "@/lib/db";

// Clears live activity recorded after seeding (alerts, messages, collation events, phone submissions) so a walkthrough can be repeated.
async function handle() {
  await q("delete from outbox");
  await q("delete from alert");
  await q("delete from collation_entry where source <> 'seed'");
  await q("delete from submission where phone like '+234809%'");
  await q("delete from witness where phone like '+234809%'");
  // keep sign-in / account events; clear only flow events
  await q("delete from audit_log where event not in ('login','logout','login_failed','register','phone_verified','user_created','user_updated')");
  return json({ ok: true });
}

export const POST = guard(["admin"], () => handle());
