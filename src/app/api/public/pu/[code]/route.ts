import { clientIp, rateLimited } from "@/lib/auth";
import { json } from "@/lib/http";
import { puNode, ussdCheck } from "@/lib/services";

// Public, read-only: the same facts anyone can get by dialling the USSD code. No phone numbers, no photos.
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (rateLimited(`pub:${clientIp(req)}`, 60, 60_000)) return json({ error: "Too many requests" }, 429);
  const { code } = await ctx.params;
  if (!/^\d{1,3}$/.test(code)) return json({ error: "Enter a 3-digit polling-unit code." }, 400);
  const pu = code.padStart(3, "0");
  const n = await puNode(pu);
  if (!n) return json({ error: "No such polling unit." }, 404);
  return json({
    code: n.code,
    ward: n.wardLabel,
    witnesses: n.witnesses ?? 0,
    status: n.status,
    wall: n.expected,
    readAtWard: n.readAtWard ?? null,
    message: await ussdCheck(pu, "en"),
  });
}
