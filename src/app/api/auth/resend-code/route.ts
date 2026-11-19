import { guard, issuePhoneCode, rateLimited, showSmsCodes } from "@/lib/auth";
import { json } from "@/lib/http";
import { sendMessage } from "@/lib/providers/sms";
import { witnessLang } from "@/lib/services";

export const POST = guard(["witness"], async (_req, _ctx, user) => {
  if (!user.phone || user.phoneVerified) return json({ error: "Nothing to verify." }, 400);
  if (rateLimited(`resend:${user.id}`, 3, 10 * 60_000)) return json({ error: "Please wait before requesting another code." }, 429);
  const code = await issuePhoneCode(user.id);
  await sendMessage({ to: user.phone, body: `Eri: your verification code is ${code}. It expires in 10 minutes.`, lang: await witnessLang(user.phone) });
  return json({ ok: true, devCode: showSmsCodes() ? code : undefined });
});
