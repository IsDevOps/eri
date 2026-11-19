import { guard } from "@/lib/auth";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PARTIES, fmt, partyName, tallyText, type Tally } from "@/lib/config";
import { q } from "@/lib/db";
import { buildTree, walk, type TreeNode } from "@/lib/reconcile";

/**
 * Tribunal evidence pack: one click -> a PU's (or ward's) witness photos, hashes, timestamps and
 * discrepancy report as a PDF for election petitions.   GET /api/tribunal?pu=034  |  ?ward=4
 */
const mask = (p: string) => p.slice(0, -6).replace(/\d/g, (d, i) => (i > 5 ? "*" : d)) + p.slice(-2);
const tally = (t: Tally | null) => (t ? PARTIES.map((p) => `${partyName(p)} ${fmt(t[p] ?? 0)}`).join("   ") : "—");

async function handle(req: Request) {
  const u = new URL(req.url).searchParams;
  const puCode = u.get("pu")?.padStart(3, "0");
  const wardNo = u.get("ward") ? parseInt(u.get("ward")!, 10) : null;
  if (!puCode && !wardNo) return new Response("pass ?pu=034 or ?ward=4", { status: 400 });

  const tree = await buildTree();
  let node: TreeNode | null = null;
  let wardNode: TreeNode | null = null;
  walk(tree, (n, parent) => {
    if (puCode && n.level === "pu" && n.code === puCode) {
      node = n;
      wardNode = parent;
    }
    if (!puCode && n.level === "ward" && n.code === String(wardNo).padStart(2, "0")) node = n;
  });
  if (!node) return new Response("not found", { status: 404 });
  const scope = node as TreeNode;
  const puList: TreeNode[] = scope.level === "pu" ? [scope] : scope.children;

  const subs = await q<{ code: string; phone: string; source: string; results: Tally; photo_hash: string | null; photo_path: string | null; confidence: number | null; created_at: Date }>(
    `select p.code, s.phone, s.source, s.results, s.photo_hash, s.photo_path, s.confidence, s.created_at
       from submission s join polling_unit p on p.id = s.pu_id
      where p.code = any($1::text[]) order by p.code, s.created_at`,
    [puList.map((p) => p.code)],
  );
  const cols = await q<{ level: string; code: string | null; wardno: number | null; results: Tally | null; dropped: boolean; source: string; transcript: string | null; created_at: Date }>(
    `select c.level, p.code, w.number as wardno, c.results, c.dropped, c.source, c.transcript, c.created_at
       from collation_entry c left join polling_unit p on p.id = c.pu_id left join ward w on w.id = c.ward_id
      where ${puCode ? "p.code = $1" : "w.number = $1"} order by c.id`,
    [puCode ?? wardNo],
  );
  const alerts = await q<{ kind: string; message: string; created_at: Date }>(
    `select a.kind, a.message, a.created_at from alert a
       left join polling_unit p on p.id = a.pu_id left join ward w on w.id = a.ward_id
      where ${puCode ? "p.code = $1" : "w.number = $1"} order by a.id`,
    [puCode ?? wardNo],
  );

  // ---- render ----
  const doc = new PDFDocument({ margin: 48, size: "A4", info: { Title: `Eri evidence pack — ${scope.label}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const ledger: string[] = []; // every fact printed, hashed at the end for tamper-evidence
  const line = (raw: string, opts: PDFKit.Mixins.TextOptions = {}) => {
    const text = raw.replace(/→/g, "->").replace(/[^\x00-\xFF]/g, "?"); // built-in PDF fonts are Latin-1 only
    ledger.push(text);
    doc.text(text, opts);
  };
  const h = (text: string) => {
    doc.moveDown(0.8).fontSize(13).fillColor("#111").font("Helvetica-Bold");
    line(text);
    doc.fontSize(9.5).font("Helvetica").fillColor("#222");
  };

  doc.fontSize(20).font("Helvetica-Bold").fillColor("#111");
  line("Eri evidence pack");
  doc.fontSize(10).font("Helvetica").fillColor("#555");
  line("Eri (Yoruba: witness, proof) - trace every vote from the polling unit to the declaration");
  line(`Generated ${new Date().toISOString()}  -  ${tree.children[0]?.label ?? "LGA"}, ${tree.label}`);
  line("Party and ward names follow INEC records; vote figures in this prototype are fictional sample data, not election results.");
  doc.fontSize(9.5).fillColor("#222");

  h(`Scope: ${scope.label}${wardNode ? ` (${(wardNode as TreeNode).label.split(" · ")[0]})` : ""}`);
  line(`Status: ${scope.status.toUpperCase()}`);
  line(scope.reason);
  line(`Polling units witnessed: ${scope.coverage.witnessed} of ${scope.coverage.total}`);

  h("Announced vs proven");
  line(`Announced / read out : ${tally(scope.announced)}`);
  line(`Proven by witnesses  : ${tally(scope.expected)}`);
  line(`Gap                  : ${tally(scope.gap)}`);

  if (scope.level === "ward") {
    h("Polling units in this ward");
    for (const p of puList) line(`PU ${p.code}  EC8A ${p.expected ? tallyText(p.expected, " ") : "none"}  |  read at ward ${p.readAtWard ? tallyText(p.readAtWard, " ") : p.dropped ? "DROPPED" : "n/a"}  |  ${p.status}  |  ${p.witnesses ?? 0} witnesses`);
  }

  h("Collation events (what was announced, when, how captured)");
  if (!cols.length) line("No collation event recorded for this scope.");
  for (const c of cols) {
    line(`${new Date(c.created_at).toISOString()}  [${c.level}${c.code ? " PU " + c.code : ""}${c.wardno ? " ward " + c.wardno : ""}] via ${c.source}: ${c.dropped ? "DROPPED" : tally(c.results)}`);
    if (c.transcript) line(`   transcript: "${c.transcript.slice(0, 220)}${c.transcript.length > 220 ? "..." : ""}"`);
  }

  h("Witness submissions (phone numbers masked)");
  for (const s of subs) {
    line(`${new Date(s.created_at).toISOString()}  PU ${s.code}  ${mask(s.phone)}  ${s.source}  ${tally(s.results)}${s.photo_hash ? `  photo sha256:${s.photo_hash.slice(0, 16)}...` : ""}${s.confidence ? `  ocr ${(s.confidence * 100).toFixed(0)}%` : ""}`);
  }

  h("Discrepancies raised");
  if (!alerts.length) line("None.");
  for (const a of alerts) line(`${new Date(a.created_at).toISOString()}  ${a.kind}: ${a.message}`);

  // embed witness photos (PU scope), if any are on disk
  if (scope.level === "pu") {
    const photos = subs.filter((s) => s.photo_path).slice(0, 3);
    for (const s of photos) {
      const rel = s.photo_path!.startsWith("/assets") ? path.join(process.cwd(), "public", s.photo_path!) : s.photo_path!;
      if (existsSync(rel)) {
        doc.addPage();
        h(`Witness photo - PU ${s.code} - ${mask(s.phone)} - sha256:${s.photo_hash}`);
        try {
          doc.image(rel, { fit: [480, 560] });
        } catch {
          line("(image could not be embedded)");
        }
      }
    }
  }

  const digest = createHash("sha256").update(ledger.join("\n")).digest("hex");
  h("Integrity");
  line(`SHA-256 of all facts printed in this report: ${digest}`);
  line("Re-generate this pack from the same database state to verify. Figures are read from witness submissions and recorded collation events; Eri does not alter source data.");
  doc.end();
  const pdf = await done;
  return new Response(new Uint8Array(pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="eri-evidence-${puCode ? "pu" + puCode : "ward" + wardNo}.pdf"` },
  });
}

export const GET = guard(["admin", "observer"], (req) => handle(req));
