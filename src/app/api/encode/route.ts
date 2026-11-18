import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { encodeResultSms } from "@/lib/sms-codec";
import { PARTIES, type Tally } from "@/lib/config";

// Helper for the phone simulator: builds a valid result SMS (with checksum) from figures.
async function handle(req: Request) {
  const u = new URL(req.url).searchParams;
  const pu = (u.get("pu") ?? "").replace(/\D/g, "").padStart(3, "0");
  const tally: Tally = {};
  for (const p of PARTIES) tally[p] = parseInt(u.get(p) ?? "0", 10) || 0;
  return json({ sms: encodeResultSms(pu, tally) });
}

export const GET = guard("any", (req) => handle(req));
