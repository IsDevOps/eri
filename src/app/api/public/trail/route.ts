import { clientIp, rateLimited } from "@/lib/auth";
import { json } from "@/lib/http";
import { toPublicTrail } from "@/lib/public-trail";
import { buildTree } from "@/lib/reconcile";

// Public, read-only. Ward / LGA / state hops only: no polling-unit rows, no phones, no photos.
export async function GET(req: Request) {
  if (rateLimited(`trail:${clientIp(req)}`, 60, 60_000)) return json({ error: "Too many requests" }, 429);
  return json(toPublicTrail(await buildTree()));
}
