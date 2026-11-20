import { guard } from "@/lib/auth";
import { ACRONYM_RE, MAX_PARTIES, nextPartyKey } from "@/lib/config";
import { q, q1, refreshParties } from "@/lib/db";
import { json } from "@/lib/http";
import { audit } from "@/lib/services";

interface Row { key: string; acronym: string; name: string; sort: number; used: boolean }

/** A party is "used" once any witness figure or collation entry carries its key; such a party can be renamed but not removed. */
const LIST = `select p.key, p.acronym, p.name, p.sort,
    (exists (select 1 from submission s where s.results ? p.key) or exists (select 1 from collation_entry c where c.results ? p.key)) as used
  from party p where p.active order by p.sort, p.key`;

export const GET = guard(["admin"], async () => json(await q<Row>(LIST)));

const clean = (b: Record<string, unknown>) => ({
  acronym: String(b.acronym ?? "").trim().toUpperCase().replace(/\s+/g, ""),
  name: String(b.name ?? "").trim().replace(/\s+/g, " "),
});

export const POST = guard(["admin"], async (req, _ctx, me) => {
  const { acronym, name } = clean((await req.json().catch(() => ({}))) as Record<string, unknown>);
  if (!ACRONYM_RE.test(acronym)) return json({ error: "The acronym must be 2–6 letters, e.g. NDC." }, 400);
  if (name.length < 3 || name.length > 80) return json({ error: "Enter the party's full name (3–80 characters)." }, 400);
  const rows = await q<{ key: string; acronym: string; sort: number }>("select key, acronym, sort from party");
  if (rows.length >= MAX_PARTIES) return json({ error: `At most ${MAX_PARTIES} parties can be tracked.` }, 400);
  if (rows.some((r) => r.acronym === acronym)) return json({ error: `${acronym} is already on the list.` }, 409);
  const key = nextPartyKey(rows.map((r) => r.key));
  if (!key) return json({ error: "No free party slot left." }, 400);
  const sort = Math.max(-1, ...rows.map((r) => r.sort)) + 1;
  await q("insert into party (key, acronym, name, sort) values ($1,$2,$3,$4)", [key, acronym, name, sort]);
  await audit("party_added", { by: me.id, key, acronym });
  await refreshParties(true);
  return json({ ok: true, key, acronym, name }, 201);
});

export const PATCH = guard(["admin"], async (req, _ctx, me) => {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = String(b.key ?? "");
  const cur = await q1<{ acronym: string }>("select acronym from party where key=$1", [key]);
  if (!cur) return json({ error: "Party not found." }, 404);
  const { acronym, name } = clean(b);
  if (!ACRONYM_RE.test(acronym)) return json({ error: "The acronym must be 2–6 letters." }, 400);
  if (name.length < 3 || name.length > 80) return json({ error: "Enter the party's full name (3–80 characters)." }, 400);
  if (await q1("select 1 from party where acronym=$1 and key<>$2", [acronym, key])) return json({ error: `${acronym} is already on the list.` }, 409);
  await q("update party set acronym=$2, name=$3 where key=$1", [key, acronym, name]);
  await audit("party_updated", { by: me.id, key, from: cur.acronym, to: acronym });
  await refreshParties(true);
  return json({ ok: true });
});

export const DELETE = guard(["admin"], async (req, _ctx, me) => {
  const key = String(new URL(req.url).searchParams.get("key") ?? "");
  const row = (await q<Row>(LIST)).find((r) => r.key === key);
  if (!row) return json({ error: "Party not found." }, 404);
  if (row.used) return json({ error: `${row.acronym} already has recorded figures, so it can't be removed. You can still rename it.` }, 409);
  const left = await q1<{ n: string }>("select count(*) n from party where active and key<>$1", [key]);
  if (Number(left?.n) < 2) return json({ error: "At least two parties must remain." }, 400);
  await q("delete from party where key=$1", [key]);
  await audit("party_removed", { by: me.id, key, acronym: row.acronym });
  await refreshParties(true);
  return json({ ok: true });
});
