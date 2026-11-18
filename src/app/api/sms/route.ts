import { handleSms } from "@/lib/channels";
import { json, readBody } from "@/lib/http";
import { webhookAllowed } from "@/lib/auth";

// Inbound SMS webhook. Africa's Talking posts form fields `from` and `text`; the simulator posts JSON.
export async function POST(req: Request) {
  if (!(await webhookAllowed(req))) return json({ error: "unauthorized webhook" }, 401);
  const b = await readBody(req);
  const from = b.from ?? b.phoneNumber;
  if (!from || !b.text) return json({ error: "from and text required" }, 400);
  return json({ reply: await handleSms(from, b.text) });
}
