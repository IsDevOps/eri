import { checkPhoneCode, guard, rateLimited } from "@/lib/auth";
import { json } from "@/lib/http";
import { audit } from "@/lib/services";

export const POST = guard(["witness"], async (req, _ctx, user) => {
  if (rateLimited(`otp:${user.id}`, 10, 10 * 60_000)) return json({ error: "Too many attempts." }, 429);
  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const r = await checkPhoneCode(user.id, String(code ?? "").trim());
  if (r === "ok") await audit("phone_verified", { uid: user.id });
  return r === "ok" ? json({ ok: true }) : json({ ok: false, error: r === "wrong" ? "Wrong code." : r === "locked" ? "Too many wrong codes. Request a new one." : "Code expired. Request a new one." }, 400);
});
