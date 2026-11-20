import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { USSD_CODE, tallyEq, tallyKey, tallyText, partyName, type Lang, type Tally, PARTIES } from "./config";
import { q, q1 } from "./db";
import { t } from "./i18n";
import { wit } from "./plural";
import { sendMessage } from "./providers/sms";
import { readSheet, sha256 } from "./providers/vision";
import { buildTree, buildTreeFromRows, loadRows, walk, type TreeNode } from "./reconcile";
import type { ExtractedEntry } from "./extract";

export const normPhone = (p: string) => p.replace(/[^\d+]/g, "");
const tallyStr = (tl: Tally) => tallyText(tl, " ");

export async function audit(event: string, detail: unknown) {
  await q("insert into audit_log (event, detail) values ($1, $2)", [event, JSON.stringify(detail)]);
}

export async function witnessLang(phone: string): Promise<Lang> {
  const w = await q1<{ lang: Lang }>("select lang from witness where phone=$1", [phone]);
  return w?.lang ?? "en";
}

export async function setVoice(phone: string, on: boolean) {
  await q(
    "insert into witness (phone, voice) values ($1,$2) on conflict (phone) do update set voice = excluded.voice",
    [phone, on],
  );
}

export async function setLang(phone: string, lang: Lang) {
  await q(
    "insert into witness (phone, lang) values ($1,$2) on conflict (phone) do update set lang = excluded.lang",
    [phone, lang],
  );
}

/* ------------------------------------------------------------------ */
/* Witness submissions (SMS / photo / WhatsApp)                        */
/* ------------------------------------------------------------------ */

export interface SubmitOpts {
  puCode: string;
  tally: Tally;
  phone: string;
  source: "sms" | "photo" | "whatsapp";
  raw?: string;
  photoHash?: string;
  photoPath?: string;
  confidence?: number;
  lang?: Lang;
}

export async function submitResult(o: SubmitOpts) {
  const pu = await q1<{ id: number; ward_id: number }>("select id, ward_id from polling_unit where code=$1", [o.puCode]);
  if (!pu) return { ok: false as const, reason: "unknown_pu" as const };
  const phone = normPhone(o.phone);
  await q(
    "insert into witness (phone, lang) values ($1,$2) on conflict (phone) do update set lang = case when $3 then excluded.lang else witness.lang end",
    [phone, o.lang ?? "en", !!o.lang],
  );
  await q(
    `insert into submission (pu_id, phone, source, results, raw, photo_hash, photo_path, confidence)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (pu_id, phone) do update set source=excluded.source, results=excluded.results, raw=excluded.raw,
       photo_hash=excluded.photo_hash, photo_path=excluded.photo_path, confidence=excluded.confidence, created_at=now()`,
    [pu.id, phone, o.source, JSON.stringify(o.tally), o.raw ?? null, o.photoHash ?? null, o.photoPath ?? null, o.confidence ?? null],
  );
  await audit("submission", { pu: o.puCode, phone, source: o.source, tally: o.tally });
  await syncAlarms();
  const node = await puNode(o.puCode);
  return { ok: true as const, agree: node?.witnesses ?? 1, node };
}

/**
 * Practice run: what would happen to this polling unit's status if this witness submitted these figures?
 * Nothing is written, no alert is raised and nobody is messaged.
 */
export async function previewResult(puCode: string, tally: Tally, phone: string) {
  const rows = await loadRows();
  const pu = rows.pus.find((p) => p.code === puCode);
  if (!pu) return { ok: false as const, reason: "unknown_pu" as const };
  const who = normPhone(phone);
  const others = rows.subs.filter((s) => s.pu_id === pu.id && s.phone !== who).length;
  rows.subs = [...rows.subs.filter((s) => !(s.pu_id === pu.id && s.phone === who)), { pu_id: pu.id, phone: who, source: "sms", results: tally, created_at: new Date() }];
  let node: TreeNode | null = null;
  walk(buildTreeFromRows(rows), (n) => {
    if (n.level === "pu" && n.code === puCode) node = n;
  });
  const found = node as TreeNode | null;
  return { ok: true as const, others, agree: found?.witnesses ?? 1, status: found?.status ?? "unverified", reason: found?.reason ?? "" };
}

/** Photo storage. UPLOAD_DIR overrides; read-only hosts (serverless) fall back to the temp dir, which does not persist. */
async function uploadDir(): Promise<string> {
  const wanted = process.env.UPLOAD_DIR || path.join(process.cwd(), "data/uploads");
  try {
    await mkdir(wanted, { recursive: true });
    return wanted;
  } catch {
    const tmp = path.join(os.tmpdir(), "eri-uploads");
    await mkdir(tmp, { recursive: true });
    return tmp;
  }
}

export async function ingestPhoto(buf: Buffer, mime: string, phone: string, source: "photo" | "whatsapp", lang?: Lang) {
  const reading = await readSheet(buf, mime);
  if (!reading.puCode) return { ok: false as const, error: "Could not read the polling-unit code on the sheet." };
  if (reading.confidence < 0.6) return { ok: false as const, error: "Photo too unclear. Please retake it flat and well lit." };
  const hash = sha256(buf);
  const dir = await uploadDir();
  const ext = (mime.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "bin";
  const file = path.join(/*turbopackIgnore: true*/ dir, `${hash}.${ext}`); // runtime upload path, not a bundle dependency
  await writeFile(file, buf);
  const res = await submitResult({
    puCode: reading.puCode,
    tally: reading.tally,
    phone,
    source,
    photoHash: hash,
    photoPath: file,
    confidence: reading.confidence,
    lang,
  });
  return { ...res, reading, hash };
}

/** Fake-result checker: forward a "result sheet" image and compare it against the witnesses. */
export async function checkImage(buf: Buffer, mime: string) {
  const reading = await readSheet(buf, mime);
  if (!reading.puCode) return { verdict: "unreadable" as const, message: "Eri could not read a polling-unit code on this image." };
  const hash = sha256(buf);
  const subs = await q<{ results: Tally; photo_hash: string | null }>(
    "select s.results, s.photo_hash from submission s join polling_unit p on p.id=s.pu_id where p.code=$1",
    [reading.puCode],
  );
  if (!subs.length)
    return { verdict: "unknown" as const, pu: reading.puCode, reading, message: `No witness has posted PU ${reading.puCode} yet. Cannot confirm this image.` };
  const matching = subs.filter((s) => tallyEq(s.results, reading.tally)).length;
  const known = subs.some((s) => s.photo_hash === hash);
  if (matching === subs.length)
    return {
      verdict: "genuine" as const,
      pu: reading.puCode,
      reading,
      message: `Matches ${wit(matching)} at PU ${reading.puCode}${known ? " and this exact photo was submitted by a witness" : ""}.`,
    };
  return {
    verdict: "fake" as const,
    pu: reading.puCode,
    reading,
    message: `Does not match ${subs.length - matching} of ${wit(subs.length)} at PU ${reading.puCode}${known ? "" : " and appears edited (no witness submitted this image)"}. Image says ${tallyStr(reading.tally)}; witnesses say ${tallyStr(subs[0].results)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Collation hops                                                      */
/* ------------------------------------------------------------------ */

export async function recordCollation(
  e: ExtractedEntry,
  meta: { source: "audio" | "manual" | "seed"; transcript?: string },
) {
  let wardId: number | null = null;
  let lgaId: number | null = null;
  let puId: number | null = null;
  if (e.level === "pu_at_ward") {
    const pu = e.pu ? await q1<{ id: number; ward_id: number }>("select id, ward_id from polling_unit where code=$1", [e.pu]) : null;
    if (!pu) return { skipped: "unknown_pu" as const };
    puId = pu.id;
    wardId = pu.ward_id;
  } else if (e.level === "ward") {
    const w = await q1<{ id: number }>("select id from ward where number=$1", [e.ward]);
    if (!w) return { skipped: "unknown_ward" as const };
    wardId = w.id;
  } else if (e.level === "lga") {
    const l = await q1<{ id: number }>("select id from lga order by id limit 1");
    lgaId = l?.id ?? null;
  }
  if (!e.dropped && !e.tally) return { skipped: "no_figures" as const };
  const results = e.dropped ? null : JSON.stringify(e.tally);
  const last = await q1<{ results: Tally | null; dropped: boolean }>(
    `select results, dropped from collation_entry where level=$1 and coalesce(ward_id,0)=$2 and coalesce(lga_id,0)=$3 and coalesce(pu_id,0)=$4 order by id desc limit 1`,
    [e.level, wardId ?? 0, lgaId ?? 0, puId ?? 0],
  );
  if (last && !!last.dropped === !!e.dropped && (e.dropped || (last.results && tallyEq(last.results, e.tally!)))) {
    return { skipped: "duplicate" as const };
  }
  await q(
    "insert into collation_entry (level, ward_id, lga_id, pu_id, results, dropped, source, transcript) values ($1,$2,$3,$4,$5,$6,$7,$8)",
    [e.level, wardId, lgaId, puId, results, !!e.dropped, meta.source, meta.transcript ?? null],
  );
  await audit("collation", { ...e, source: meta.source });
  const alerts = await syncAlarms();
  return { recorded: true as const, alerts };
}

/* ------------------------------------------------------------------ */
/* Witness Alarm                                                       */
/* ------------------------------------------------------------------ */

async function notify(
  puIds: number[],
  alertId: number,
  key: "alarm_pu_changed" | "alarm_pu_dropped" | "alarm_ward_inflated" | "alarm_lga_mismatch",
  varsFor: (pu: { code: string; ward: number }) => Record<string, string | number>,
) {
  if (!puIds.length) return 0;
  const rows = await q<{ phone: string; lang: Lang; code: string; ward: number; voice: boolean }>(
    `select s.phone, coalesce(w.lang,'en') as lang, coalesce(w.voice,false) as voice, p.code, wd.number as ward
       from submission s
       join polling_unit p on p.id = s.pu_id
       join ward wd on wd.id = p.ward_id
       left join witness w on w.phone = s.phone
      where s.pu_id = any($1::int[])`,
    [puIds],
  );
  // one SMS per phone per alert (a phone may have witnessed several PUs)
  const seen = new Set<string>();
  let n = 0;
  for (const r of rows) {
    if (seen.has(r.phone)) continue;
    seen.add(r.phone);
    const body = t(key, r.lang, { ussd: USSD_CODE, ...varsFor({ code: r.code, ward: r.ward }) });
    await sendMessage({ to: r.phone, lang: r.lang, alertId, body });
    if (r.voice) await sendMessage({ to: r.phone, lang: r.lang, alertId, body, channel: "voice" });
    n += 1;
  }
  return n;
}

export async function syncAlarms() {
  const tree = await buildTree();
  const flagged: { node: TreeNode; parent: TreeNode | null }[] = [];
  walk(tree, (n, parent) => {
    if (n.status === "flagged" && n.level !== "state") flagged.push({ node: n, parent });
  });
  const created: { id: number; kind: string; message: string }[] = [];
  for (const { node, parent } of flagged) {
    let kind = "";
    let fp = "";
    let message = node.reason;
    const level: string = node.level;
    let wardId: number | null = null;
    let lgaId: number | null = null;
    let puId: number | null = null;
    let notifyPus: number[] = [];
    let send: ((alertId: number) => Promise<number>) | null = null;
    const worst = node.gap ? [...PARTIES].sort((a, b) => Math.abs(node.gap![b] ?? 0) - Math.abs(node.gap![a] ?? 0))[0] : PARTIES[0];
    if (node.level === "pu") {
      kind = node.dropped ? "pu_dropped" : "pu_changed";
      puId = node.refId;
      wardId = parent?.refId ?? null;
      fp = `${kind}:${node.code}:${node.dropped ? "x" : tallyKey(node.readAtWard ?? {})}:${tallyKey(node.expected ?? {})}`;
      message = `${node.label} (${parent?.label.split(" · ")[0]}): ${node.reason}`;
      notifyPus = [node.refId];
      const wardNo = parseInt(parent?.code ?? "0", 10);
      send = (id) =>
        notify(notifyPus, id, node.dropped ? "alarm_pu_dropped" : "alarm_pu_changed", (pu) => ({
          pu: pu.code,
          ward: wardNo,
          ec8a: tallyStr(node.expected ?? {}),
          read: tallyStr(node.readAtWard ?? {}),
        }));
    } else if (node.level === "ward") {
      kind = "ward_inflated";
      wardId = node.refId;
      fp = `${kind}:${node.refId}:${tallyKey(node.announced ?? {})}:${tallyKey(node.witnessedSum)}`;
      notifyPus = node.children.map((c) => c.refId);
      send = (id) =>
        notify(notifyPus, id, "alarm_ward_inflated", (pu) => ({
          pu: pu.code,
          ward: pu.ward,
          party: partyName(worst),
          announced: node.announced?.[worst as keyof Tally] ?? 0,
          ec8asum: node.witnessedSum[worst as keyof Tally] ?? 0,
          gap: Math.abs(node.gap?.[worst as keyof Tally] ?? 0),
        }));
    } else if (node.level === "lga") {
      kind = "lga_mismatch";
      lgaId = node.refId;
      fp = `${kind}:${node.refId}:${tallyKey(node.announced ?? {})}:${tallyKey(node.expected ?? {})}`;
      notifyPus = node.children.flatMap((w) => w.children.map((p) => p.refId));
      send = (id) =>
        notify(notifyPus, id, "alarm_lga_mismatch", (pu) => ({
          pu: pu.code,
          party: partyName(worst),
          announced: node.announced?.[worst as keyof Tally] ?? 0,
          ec8asum: node.expected?.[worst as keyof Tally] ?? 0,
        }));
    } else continue;
    const row = await q1<{ id: number }>(
      `insert into alert (kind, severity, level, ward_id, lga_id, pu_id, message, detail, fingerprint)
       values ($1,'red',$2,$3,$4,$5,$6,$7,$8) on conflict (fingerprint) do nothing returning id`,
      [
        kind,
        level,
        wardId,
        lgaId,
        puId,
        message,
        JSON.stringify({ announced: node.announced, expected: node.expected, gap: node.gap }),
        fp,
      ],
    );
    if (row) {
      const sent = await send!(row.id);
      await audit("alert", { id: row.id, kind, message, smsSent: sent });
      created.push({ id: row.id, kind, message });
    }
  }
  return created;
}

/* ------------------------------------------------------------------ */
/* Lookups (USSD, API)                                                 */
/* ------------------------------------------------------------------ */

export async function puNode(puCode: string): Promise<(TreeNode & { wardNumber: number; wardLabel: string }) | null> {
  const tree = await buildTree();
  let found: (TreeNode & { wardNumber: number; wardLabel: string }) | null = null;
  walk(tree, (n, parent) => {
    if (n.level === "pu" && n.code === puCode && parent) {
      const { entries: _entries, ...rest } = n; // individual witness entries are for the observer tree only
      void _entries;
      found = { ...rest, wardNumber: parseInt(parent.code ?? "0", 10), wardLabel: parent.label };
    }
  });
  return found;
}

export async function ussdCheck(puCodeRaw: string, lang: Lang): Promise<string> {
  const code = puCodeRaw.replace(/\D/g, "").padStart(3, "0");
  const n = await puNode(code);
  if (!n) return t("ussd_unknown", lang, { pu: code });
  const base = { pu: code, ward: n.wardNumber, n: n.witnesses ?? 0, d: n.disagreeing ?? 0, tally: tallyStr(n.expected ?? {}) };
  if (!n.witnesses) return t("ussd_none", lang, base);
  if (n.dropped) return t("ussd_dropped", lang, { ...base, ec8a: tallyStr(n.expected ?? {}) });
  if (n.readAtWard && n.expected && !tallyEq(n.readAtWard, n.expected))
    return t("ussd_changed", lang, { ...base, ec8a: tallyStr(n.expected), read: tallyStr(n.readAtWard) });
  if (n.disagreeing) return t("ussd_contested", lang, base);
  if (n.readAtWard) return t("ussd_verified", lang, base);
  return t("ussd_pending", lang, base);
}
