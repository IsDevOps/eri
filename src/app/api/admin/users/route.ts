import { guard, ROLES, type Role } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { json } from "@/lib/http";
import { hashPassword, passwordProblem } from "@/lib/password";
import { audit, normPhone } from "@/lib/services";

const COLS = "id, email, name, role, phone, phone_verified, disabled, created_at";

export const GET = guard(["admin"], async () => json(await q(`select ${COLS} from app_user order by id`)));

export const POST = guard(["admin"], async (req, _ctx, me) => {
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const email = String(b.email ?? "").trim().toLowerCase();
  const name = String(b.name ?? "").trim();
  const role = b.role as Role;
  const phone = b.phone ? normPhone(b.phone) : null;
  if (!ROLES.includes(role)) return json({ error: "Invalid role." }, 400);
  if (name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Name and a valid email are required." }, 400);
  if (role === "witness" && !phone) return json({ error: "Witnesses need a phone number." }, 400);
  const pw = passwordProblem(String(b.password ?? ""));
  if (pw) return json({ error: pw }, 400);
  if (await q1("select 1 from app_user where lower(email)=$1", [email])) return json({ error: "Email already in use." }, 409);
  if (phone && (await q1("select 1 from app_user where phone=$1 and phone_verified", [phone]))) return json({ error: "Phone already belongs to a verified account." }, 409);
  const u = await q1(
    `insert into app_user (email, name, role, pass_hash, phone, phone_verified) values ($1,$2,$3,$4,$5,$6) returning ${COLS}`,
    [email, name, role, await hashPassword(b.password), phone, !!phone], // admin-created = verified by the admin
  );
  await audit("user_created", { by: me.id, email, role });
  return json(u, 201);
});

export const PATCH = guard(["admin"], async (req, _ctx, me) => {
  const b = (await req.json().catch(() => ({}))) as { id?: number; role?: Role; disabled?: boolean; password?: string };
  const target = await q1<{ id: number; role: Role; disabled: boolean }>("select id, role, disabled from app_user where id=$1", [b.id]);
  if (!target) return json({ error: "User not found." }, 404);
  const demotes = (b.role && b.role !== "admin" && target.role === "admin") || (b.disabled === true && target.role === "admin");
  if (demotes) {
    if (target.id === me.id) return json({ error: "You can't demote or disable your own admin account." }, 400);
    const left = await q1<{ n: string }>("select count(*) n from app_user where role='admin' and not disabled and id<>$1", [target.id]);
    if (Number(left?.n) < 1) return json({ error: "There must be at least one active admin." }, 400);
  }
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return json({ error: "Invalid role." }, 400);
    await q("update app_user set role=$2 where id=$1", [target.id, b.role]);
  }
  if (typeof b.disabled === "boolean") await q("update app_user set disabled=$2 where id=$1", [target.id, b.disabled]);
  if (b.password) {
    const pw = passwordProblem(b.password);
    if (pw) return json({ error: pw }, 400);
    await q("update app_user set pass_hash=$2 where id=$1", [target.id, await hashPassword(b.password)]);
  }
  await audit("user_updated", { by: me.id, target: target.id, role: b.role, disabled: b.disabled, password: !!b.password });
  return json({ ok: true });
});
