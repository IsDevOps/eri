import { HOME, clientIp, issuePhoneCode, rateLimited, sameOrigin, showSmsCodes, startSession } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { json } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/password";
import { sendMessage } from "@/lib/providers/sms";
import { audit, normPhone, witnessLang } from "@/lib/services";

// Self-service sign-up: the person chooses witness or observer. Admin accounts can only be created by an admin.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "cross-site request refused" }, 403);
  if (rateLimited(`reg:${clientIp(req)}`, 10, 60 * 60_000)) return json({ error: "Too many sign-ups from this address. Try later." }, 429);
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const phone = normPhone(String(b.phone ?? ""));
  const password = String(b.password ?? "");
  const role = b.role === "observer" ? "observer" : b.role === "witness" ? "witness" : null;
  if (!role) return json({ error: "Choose whether you are a witness or an observer." }, 400);
  if (name.length < 2) return json({ error: "Please enter your name." }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  // Witnesses are reached by SMS, so their phone is required and verified. Observers sign in with email only.
  if (role === "witness" && !/^\+\d{10,15}$/.test(phone)) return json({ error: "Enter your phone number with country code, e.g. +2348031230034." }, 400);
  const pw = passwordProblem(password);
  if (pw) return json({ error: pw }, 400);
  if (await q1("select 1 from app_user where lower(email)=$1", [email])) return json({ error: "That email is already registered." }, 409);
  if (role === "witness" && (await q1("select 1 from app_user where phone=$1 and phone_verified", [phone])))
    return json({ error: "That phone number already belongs to a verified account." }, 409);

  const u = await q1<{ id: number }>(
    "insert into app_user (email, name, role, pass_hash, phone) values ($1,$2,$3,$4,$5) returning id",
    [email, name, role, await hashPassword(password), role === "witness" ? phone : null],
  );
  if (role === "observer") {
    await audit("register", { uid: u!.id, role });
    await startSession({ id: u!.id, role });
    return json({ ok: true, home: HOME.observer });
  }
  const code = await issuePhoneCode(u!.id);
  await sendMessage({ to: phone, body: `Eri: your verification code is ${code}. It expires in 10 minutes.`, lang: await witnessLang(phone) });
  await audit("register", { uid: u!.id, role });
  await startSession({ id: u!.id, role });
  return json({ ok: true, home: "/witness", devCode: showSmsCodes() ? code : undefined });
}
