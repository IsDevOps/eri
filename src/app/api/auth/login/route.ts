import { HOME, clearFails, clientIp, isLocked, recordFail, sameOrigin, startSession, type Role } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { json } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { audit } from "@/lib/services";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "cross-site request refused" }, 403);
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const ipKey = `ip:${clientIp(req)}`;
  const mailKey = `mail:${email}`;
  if (isLocked(ipKey, 30) || isLocked(mailKey, 6)) return json({ error: "Too many failed attempts. Try again in 15 minutes." }, 429);

  const u = await q1<{ id: number; role: Role; pass_hash: string; disabled: boolean; name: string }>(
    "select id, role, pass_hash, disabled, name from app_user where lower(email)=$1",
    [email],
  );
  const ok = await verifyPassword(password, u?.pass_hash); // same cost whether or not the email exists
  if (!u || !ok || u.disabled) {
    recordFail(ipKey);
    recordFail(mailKey);
    await audit("login_failed", { email, ip: clientIp(req) });
    return json({ error: "Wrong email or password." }, 401);
  }
  clearFails(mailKey);
  await startSession(u);
  await audit("login", { uid: u.id, role: u.role });
  return json({ ok: true, role: u.role, name: u.name, home: HOME[u.role] });
}
