import { q } from "../db";
import type { Lang } from "../config";

/**
 * SMS/voice provider interface. Default = simulator: messages are written to `outbox`
 * and rendered on the /phone simulator. With AT_API_KEY + AT_USERNAME set, messages are
 * also sent for real through Africa's Talking (SMS). Voice is a stretch goal.
 */
export interface OutboundMessage {
  to: string;
  body: string;
  lang: Lang;
  channel?: "sms" | "voice";
  alertId?: number | null;
}

export async function sendMessage(m: OutboundMessage): Promise<void> {
  let status = "simulated";
  const user = process.env.AT_USERNAME;
  const key = process.env.AT_API_KEY;
  if (user && key && (m.channel ?? "sms") === "sms") {
    try {
      const host = user === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
      const body = new URLSearchParams({ username: user, to: m.to, message: m.body });
      if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
      const res = await fetch(`https://${host}/version1/messaging`, {
        method: "POST",
        headers: { apiKey: key, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      status = res.ok ? "sent" : `failed:${res.status}`;
    } catch {
      status = "failed";
    }
  }
  await q("insert into outbox (channel, to_phone, lang, body, alert_id, status) values ($1,$2,$3,$4,$5,$6)", [
    m.channel ?? "sms",
    m.to,
    m.lang,
    m.body,
    m.alertId ?? null,
    status,
  ]);
}
