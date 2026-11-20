import { guard } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import { json } from "@/lib/http";
import { audit } from "@/lib/services";

interface WardRow { id: number; number: number; name: string; lga: string; pus: { id: number; code: string; name: string; registered: number; submissions: number }[] }

export const GET = guard(["admin"], async () => {
  const wards = await q<WardRow>(
    `select w.id, w.number, w.name, l.name as lga,
       coalesce((select json_agg(json_build_object('id', p.id, 'code', p.code, 'name', p.name, 'registered', p.registered,
                  'submissions', (select count(*)::int from submission s where s.pu_id = p.id)) order by p.code)
                   from polling_unit p where p.ward_id = w.id), '[]'::json) as pus
       from ward w join lga l on l.id = w.lga_id order by l.id, w.number`,
  );
  return json(wards);
});

const text = (v: unknown, max: number) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);

export const POST = guard(["admin"], async (req, _ctx, me) => {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.kind === "ward") {
    const name = text(b.name, 60);
    if (name.length < 2) return json({ error: "Enter the ward's name." }, 400);
    const lga = await q1<{ id: number }>("select id from lga order by id limit 1");
    if (!lga) return json({ error: "No local government area exists yet." }, 400);
    if (await q1("select 1 from ward where lga_id=$1 and lower(name)=lower($2)", [lga.id, name])) return json({ error: `A ward called ${name} already exists.` }, 409);
    const n = await q1<{ n: number }>("select coalesce(max(number),0)+1 as n from ward where lga_id=$1", [lga.id]);
    const w = await q1<{ id: number; number: number }>("insert into ward (lga_id, number, name) values ($1,$2,$3) returning id, number", [lga.id, n!.n, name]);
    await audit("ward_added", { by: me.id, ward: w!.number, name });
    return json({ ok: true, ...w }, 201);
  }

  if (b.kind === "pu") {
    const ward = await q1<{ id: number; number: number }>("select id, number from ward where id=$1", [Number(b.wardId)]);
    if (!ward) return json({ error: "Pick a ward." }, 400);
    const name = text(b.name, 80);
    if (name.length < 2) return json({ error: "Enter the polling unit's name." }, 400);
    const registered = b.registered === "" || b.registered == null ? 500 : Number(b.registered);
    if (!Number.isInteger(registered) || registered < 1 || registered > 5000) return json({ error: "Registered voters must be a whole number from 1 to 5000." }, 400);
    let code = text(b.code, 3).replace(/\D/g, "");
    if (code) {
      code = code.padStart(3, "0");
      if (code === "000") return json({ error: "Code 000 isn't allowed." }, 400);
      if (await q1("select 1 from polling_unit where code=$1", [code])) return json({ error: `Code ${code} is already used by another polling unit.` }, 409);
    } else {
      const m = await q1<{ n: number }>("select coalesce(max(code::int),0)+1 as n from polling_unit");
      if (m!.n > 999) return json({ error: "All 999 polling-unit codes are in use." }, 400);
      code = String(m!.n).padStart(3, "0");
    }
    const pu = await q1<{ id: number; code: string }>("insert into polling_unit (ward_id, code, name, registered) values ($1,$2,$3,$4) returning id, code", [ward.id, code, name, registered]);
    await audit("pu_added", { by: me.id, code, ward: ward.number, name });
    return json({ ok: true, ...pu, ward: ward.number }, 201);
  }
  return json({ error: "Unknown request." }, 400);
});

export const DELETE = guard(["admin"], async (req, _ctx, me) => {
  const u = new URL(req.url).searchParams;
  if (u.get("pu")) {
    const pu = await q1<{ id: number; code: string }>("select id, code from polling_unit where code=$1", [u.get("pu")!.padStart(3, "0")]);
    if (!pu) return json({ error: "Polling unit not found." }, 404);
    const used = await q1("select 1 from submission where pu_id=$1 union all select 1 from collation_entry where pu_id=$1 union all select 1 from alert where pu_id=$1", [pu.id]);
    if (used) return json({ error: `PU ${pu.code} already has recorded activity, so it can't be removed.` }, 409);
    await q("delete from polling_unit where id=$1", [pu.id]);
    await audit("pu_removed", { by: me.id, code: pu.code });
    return json({ ok: true });
  }
  if (u.get("ward")) {
    const w = await q1<{ id: number; number: number }>("select id, number from ward where number=$1", [Number(u.get("ward"))]);
    if (!w) return json({ error: "Ward not found." }, 404);
    if (await q1("select 1 from polling_unit where ward_id=$1", [w.id])) return json({ error: "Remove or move the ward's polling units first." }, 409);
    if (await q1("select 1 from collation_entry where ward_id=$1 union all select 1 from alert where ward_id=$1", [w.id])) return json({ error: "This ward already has recorded activity, so it can't be removed." }, 409);
    await q("delete from ward where id=$1", [w.id]);
    await audit("ward_removed", { by: me.id, ward: w.number });
    return json({ ok: true });
  }
  return json({ error: "Pass ?pu=CODE or ?ward=NUMBER." }, 400);
});
