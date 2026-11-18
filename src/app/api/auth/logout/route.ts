import { endSession, getUser, sameOrigin } from "@/lib/auth";
import { json } from "@/lib/http";
import { audit } from "@/lib/services";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "cross-site request refused" }, 403);
  const u = await getUser();
  if (u) await audit("logout", { uid: u.id });
  await endSession();
  return json({ ok: true });
}
