import { handleUssd } from "@/lib/channels";
import { readBody } from "@/lib/http";
import { webhookAllowed } from "@/lib/auth";

// USSD callback (Africa's Talking shape): sessionId, serviceCode, phoneNumber, text -> "CON ..." | "END ..."
export async function POST(req: Request) {
  if (!(await webhookAllowed(req))) return new Response("END Unauthorized", { status: 401 });
  const b = await readBody(req);
  if (!b.phoneNumber) return new Response("END Missing phoneNumber", { status: 400 });
  const out = await handleUssd(b.phoneNumber, b.text ?? "");
  return new Response(out, { headers: { "content-type": "text/plain" } });
}
