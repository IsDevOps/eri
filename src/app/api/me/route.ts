import { guard } from "@/lib/auth";
import { LANGS, type Lang } from "@/lib/config";
import { q, q1 } from "@/lib/db";
import { json } from "@/lib/http";
import { puNode, setLang, setVoice } from "@/lib/services";

/** The signed-in user's own profile. For witnesses: their walls, the status of each, and the alerts sent to their (verified) phone. */
export const GET = guard("any", async (_req, _ctx, user) => {
  if (user.role !== "witness" || !user.phone || !user.phoneVerified) return json({ user, prefs: null, submissions: [], messages: [] });
  const prefs = await q1<{ lang: Lang; voice: boolean }>("select lang, voice from witness where phone=$1", [user.phone]);
  const subs = await q<{ code: string; ward: number; source: string; results: Record<string, number>; created_at: string }>(
    `select p.code, w.number as ward, s.source, s.results, s.created_at
       from submission s join polling_unit p on p.id = s.pu_id join ward w on w.id = p.ward_id
      where s.phone=$1 order by s.created_at desc`,
    [user.phone],
  );
  const submissions = await Promise.all(
    subs.map(async (s) => {
      const n = await puNode(s.code);
      return { ...s, status: n?.status ?? "pending", reason: n?.reason ?? "", witnesses: n?.witnesses ?? 0, readAtWard: n?.readAtWard ?? null };
    }),
  );
  const messages = await q("select id, channel, lang, body, created_at from outbox where to_phone=$1 and body not like 'Eri: your verification code%' order by id desc limit 30", [user.phone]);
  return json({ user, prefs: prefs ?? { lang: "en", voice: false }, submissions, messages });
});

export const PATCH = guard(["witness"], async (req, _ctx, user) => {
  if (!user.phone || !user.phoneVerified) return json({ error: "Verify your phone first." }, 403);
  const b = (await req.json().catch(() => ({}))) as { lang?: string; voice?: boolean };
  if (b.lang !== undefined) {
    if (!LANGS.includes(b.lang as Lang)) return json({ error: "unknown language" }, 400);
    await setLang(user.phone, b.lang as Lang);
  }
  if (typeof b.voice === "boolean") await setVoice(user.phone, b.voice);
  return json({ ok: true });
});
