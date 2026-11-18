import { guard } from "@/lib/auth";
import { PARTIES, type Tally } from "@/lib/config";
import { json } from "@/lib/http";
import { submitResult } from "@/lib/services";

// A signed-in, phone-verified witness submits the figures on the EC8A wall sheet. The identity is the session, never a client-supplied phone.
export const POST = guard(["witness"], async (req, _ctx, user) => {
  if (!user.phone || !user.phoneVerified) return json({ ok: false, error: "Verify your phone number before submitting results." }, 403);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const pu = String(b.pu ?? "").replace(/\D/g, "").padStart(3, "0");
  const tally: Tally = {};
  for (const p of PARTIES) {
    const n = Number(b[p] ?? 0);
    if (!Number.isInteger(n) || n < 0 || n > 100000) return json({ ok: false, error: `Party ${p}: enter a whole number between 0 and 100000.` }, 400);
    tally[p] = n;
  }
  const r = await submitResult({ puCode: pu, tally, phone: user.phone, source: "sms", raw: "portal" });
  if (!r.ok) return json({ ok: false, error: `No polling unit with code ${pu}.` }, 404);
  return json({ ok: true, pu, agree: r.agree, status: r.node?.status, reason: r.node?.reason });
});
