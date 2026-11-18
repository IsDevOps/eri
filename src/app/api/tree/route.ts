import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { buildTree } from "@/lib/reconcile";

async function handle() {
  return json(await buildTree());
}

export const GET = guard(["admin", "observer"], () => handle());
