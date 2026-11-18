/**
 * Seeds the synthetic, non-partisan demo: "Demo State" -> Eriwa LGA -> 4 wards -> 40 polling units.
 * Also renders demo EC8A sheets (PNG) and demo collation-centre audio (macOS `say`).
 *   npm run seed
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PARTIES, emptyTally, type Lang, type Tally } from "../src/lib/config";
import { pool, q } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";
import { SCHEMA_SQL } from "../src/lib/schema";
import { checksum, encodeResultSms } from "../src/lib/sms-codec";

const ROOT = process.cwd();
// SEED_KEEP_ASSETS=1 (used in Docker, where macOS `say` and fonts are unavailable): keep the shipped demo PNG/WAV files
// and only (re)compute their hashes instead of re-rendering them.
const KEEP_ASSETS = process.env.SEED_KEEP_ASSETS === "1";
const sha = (f: string) => createHash("sha256").update(readFileSync(f)).digest("hex");

/* ---------- deterministic PRNG so every run builds the same world ---------- */
let seed = 20261118;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const between = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

/* ---------- number -> words (for the spoken clips) ---------- */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " and " + words(n % 100) : "");
  return words(Math.floor(n / 1000)) + " thousand" + (n % 1000 ? (n % 1000 < 100 ? " and " : " ") + words(n % 1000) : "");
}
const digitWords = (s: string) => s.split("").map((d) => ONES[+d]).join(" ");
const spokenTally = (t: Tally) => PARTIES.map((p) => `Party ${p} ${words(t[p] ?? 0)}.`).join(" ");

/* ---------- world ---------- */
const WARD_NAMES = ["Ayegbe", "Obiaja", "Tudun Mata", "Ikoro"];
const NO_WITNESS = new Set(["017", "029"]); // two walls nobody has photographed yet (live-demo targets)
const AMAKA_PU = "034";
const AMAKA_PHONE = "+2348031230034";
const LANG_CYCLE: Lang[] = ["en", "pcm", "yo", "ha", "ig"];

type PU = { code: string; ward: number; registered: number; tally: Tally };

function buildPUs(): PU[] {
  const pus: PU[] = [];
  for (let ward = 1; ward <= 4; ward++) {
    const list: PU[] = [];
    for (let i = 1; i <= 10; i++) {
      const code = String((ward - 1) * 10 + i).padStart(3, "0");
      list.push({
        code,
        ward,
        registered: between(700, 1100),
        tally: { A: between(140, 240), B: between(90, 190), C: between(30, 90), D: between(5, 40) },
      });
    }
    if (ward === 4) {
      // Pin ward 04's witnessed A-total at exactly 1,880 (matches the pitch's example flag).
      const sum = list.reduce((s, p) => s + p.tally.A!, 0);
      let diff = 1880 - sum;
      let i = 0;
      while (diff !== 0) {
        const step = diff > 0 ? 1 : -1;
        list[i % 10].tally.A! += step;
        diff -= step;
        i++;
      }
    }
    pus.push(...list);
  }
  return pus;
}

const sumTallies = (ts: Tally[]): Tally => {
  const out = emptyTally();
  for (const t of ts) for (const p of PARTIES) out[p] += t[p] ?? 0;
  return out;
};

/* ---------- demo EC8A sheet renderer ---------- */
async function renderSheet(file: string, pu: string, ward: number, t: Tally, opts: { stamp?: string } = {}) {
  const rows = PARTIES.map(
    (p, i) => `
    <rect x="60" y="${250 + i * 90}" width="560" height="80" fill="none" stroke="#222" stroke-width="2"/>
    <text x="80" y="${303 + i * 90}" font-size="34" font-family="Helvetica, Arial" fill="#222">PARTY ${p}</text>
    <text x="400" y="${305 + i * 90}" font-size="48" font-family="'Bradley Hand','Noteworthy','Comic Sans MS',cursive" fill="#1a3a8a">${t[p] ?? 0}</text>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="760" viewBox="0 0 680 760">
    <rect width="680" height="760" fill="#fbfaf4"/>
    <rect x="30" y="30" width="620" height="700" fill="none" stroke="#222" stroke-width="3"/>
    <text x="340" y="85" font-size="38" text-anchor="middle" font-family="Helvetica, Arial" font-weight="bold" fill="#222">FORM EC8A (SYNTHETIC DEMO)</text>
    <text x="340" y="120" font-size="20" text-anchor="middle" font-family="Helvetica, Arial" fill="#555">Statement of result of poll from polling unit</text>
    <text x="60" y="180" font-size="28" font-family="Helvetica, Arial" fill="#222">WARD:</text>
    <text x="170" y="182" font-size="40" font-family="'Bradley Hand','Noteworthy','Comic Sans MS',cursive" fill="#1a3a8a">${String(ward).padStart(2, "0")}</text>
    <text x="300" y="180" font-size="28" font-family="Helvetica, Arial" fill="#222">PU CODE:</text>
    <text x="450" y="182" font-size="40" font-family="'Bradley Hand','Noteworthy','Comic Sans MS',cursive" fill="#1a3a8a">${pu}</text>
    ${rows}
    <text x="60" y="690" font-size="20" font-family="Helvetica, Arial" fill="#777">Presiding officer signature: ________________</text>
    ${opts.stamp ? `<text x="340" y="150" font-size="14" text-anchor="middle" fill="#aaa">${opts.stamp}</text>` : ""}
  </svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(file, buf);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  console.log("→ schema");
  await pool.query(SCHEMA_SQL);

  const pus = buildPUs();
  console.log("→ geography");
  const lga = (await q<{ id: number }>("insert into lga (code, name, state) values ('ERW','Eriwa','Demo State') returning id"))[0];
  const wardIds: Record<number, number> = {};
  for (let w = 1; w <= 4; w++) {
    wardIds[w] = (
      await q<{ id: number }>("insert into ward (lga_id, number, name) values ($1,$2,$3) returning id", [lga.id, w, WARD_NAMES[w - 1]])
    )[0].id;
  }
  const puIds: Record<string, number> = {};
  for (const p of pus) {
    puIds[p.code] = (
      await q<{ id: number }>("insert into polling_unit (ward_id, code, name, registered) values ($1,$2,$3,$4) returning id", [
        wardIds[p.ward],
        p.code,
        `${WARD_NAMES[p.ward - 1]} PU ${p.code}`,
        p.registered,
      ])
    )[0].id;
  }

  /* ---------- demo assets ---------- */
  console.log("→ demo EC8A sheets");
  const ecDir = path.join(ROOT, "public/demo/ec8a");
  if (!KEEP_ASSETS) rmSync(ecDir, { recursive: true, force: true });
  mkdirSync(ecDir, { recursive: true });
  const ecManifest: Record<string, { pu: string; tally: Tally; note: string; file: string }> = {};
  const byCode = Object.fromEntries(pus.map((p) => [p.code, p]));
  const sheet = async (file: string, pu: string, tally: Tally, note: string, stamp?: string) => {
    const h = KEEP_ASSETS ? sha(path.join(ecDir, file)) : await renderSheet(path.join(ecDir, file), pu, byCode[pu].ward, tally, { stamp });
    ecManifest[h] = { pu, tally, note, file };
    return h;
  };
  const amakaSheetHash = await sheet("pu034-genuine.png", AMAKA_PU, byCode[AMAKA_PU].tally, "Genuine sheet photographed at the polling unit");
  const editedTally = { ...byCode[AMAKA_PU].tally, A: byCode[AMAKA_PU].tally.A! + 150 };
  await sheet("pu034-edited.png", AMAKA_PU, editedTally, "Viral edited sheet: Party A inflated by 150", "forwarded many times");
  await sheet("pu017-live.png", "017", byCode["017"].tally, "Live demo: first witness photo for PU 017");
  await sheet("pu029-live.png", "029", byCode["029"].tally, "Live demo: first witness photo for PU 029");
  writeFileSync(path.join(ecDir, "manifest.json"), JSON.stringify(ecManifest, null, 2));

  /* ---------- witnesses & submissions ---------- */
  console.log("→ witnesses");
  const sources = ["sms", "sms", "sms", "photo", "whatsapp", "sms"] as const;
  let nSubs = 0;
  for (const p of pus) {
    if (NO_WITNESS.has(p.code)) continue;
    const n = between(3, 6);
    for (let k = 1; k <= n; k++) {
      const isAmaka = p.code === AMAKA_PU && k === 1;
      const phone = isAmaka ? AMAKA_PHONE : `+23480000${p.code}${String(k).padStart(2, "0")}`;
      const lang = isAmaka ? "ig" : LANG_CYCLE[(Number(p.code) + k) % 5];
      const source = isAmaka ? "whatsapp" : sources[(k - 1) % sources.length];
      const voice = p.code === AMAKA_PU && k === 2; // one witness who also wants a spoken alert
      await q("insert into witness (phone, lang, voice) values ($1,$2,$3) on conflict do nothing", [phone, voice ? "yo" : lang, voice]);
      await q(
        "insert into submission (pu_id, phone, source, results, raw, photo_hash, photo_path, confidence) values ($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          puIds[p.code],
          phone,
          source,
          JSON.stringify(p.tally),
          source === "sms" ? encodeResultSms(p.code, p.tally) : null,
          isAmaka ? amakaSheetHash : null,
          isAmaka ? "/demo/ec8a/pu034-genuine.png" : null,
          source === "sms" ? null : 0.96,
        ],
      );
      nSubs++;
    }
  }
  console.log(`   ${nSubs} witness submissions across ${40 - NO_WITNESS.size} polling units`);

  /* ---------- collation already announced for wards 1-3 (all honest) ---------- */
  console.log("→ collation (wards 01-03)");
  const insertCol = (level: string, ward: number | null, lgaId: number | null, pu: string | null, t: Tally | null, source = "seed") =>
    q("insert into collation_entry (level, ward_id, lga_id, pu_id, results, dropped, source) values ($1,$2,$3,$4,$5,false,$6)", [
      level,
      ward ? wardIds[ward] : null,
      lgaId,
      pu ? puIds[pu] : null,
      t ? JSON.stringify(t) : null,
      source,
    ]);
  const wardTotals: Record<number, Tally> = {};
  for (let w = 1; w <= 3; w++) {
    const members = pus.filter((p) => p.ward === w);
    for (const p of members) await insertCol("pu_at_ward", w, null, p.code, p.tally);
    wardTotals[w] = sumTallies(members.map((p) => p.tally)); // includes any unwitnessed PU
    await insertCol("ward", w, null, null, wardTotals[w]);
  }

  /* ---------- live-demo audio clips (macOS `say`) ---------- */
  console.log("→ demo audio");
  const auDir = path.join(ROOT, "public/demo/audio");
  if (!KEEP_ASSETS) rmSync(auDir, { recursive: true, force: true });
  mkdirSync(auDir, { recursive: true });
  const ward4 = pus.filter((p) => p.ward === 4);
  const w4True = sumTallies(ward4.map((p) => p.tally));
  const w4Announced: Tally = { ...w4True, A: w4True.A! + 1240 }; // +1,240 unexplained
  const amakaChanged: Tally = { ...byCode[AMAKA_PU].tally, A: byCode[AMAKA_PU].tally.A! + 50 };
  const lgaTotal = sumTallies([wardTotals[1], wardTotals[2], wardTotals[3], w4Announced]);

  const clips = [
    {
      file: "ward04-collation.wav",
      label: "Ward 04 collation (EC8B): PU 034 read out + ward total",
      text:
        `Ward ${digitWords("04")} collation. ` +
        `Polling unit ${digitWords(AMAKA_PU)}. ${spokenTally(amakaChanged)} ` +
        `Ward ${digitWords("04")} total. ${spokenTally(w4Announced)}`,
    },
    {
      file: "lga-collation.wav",
      label: "Eriwa LGA collation (EC8C): LGA total",
      text: `Eriwa local government collation. LGA total. ${spokenTally(lgaTotal)}`,
    },
  ];
  const auManifest: Record<string, { transcript: string; label: string; file: string }> = {};
  for (const c of clips) {
    const aiff = path.join(auDir, c.file.replace(".wav", ".aiff"));
    const wav = path.join(auDir, c.file);
    if (KEEP_ASSETS) {
      auManifest[sha(wav)] = { transcript: c.text, label: c.label, file: c.file };
      continue;
    }
    try {
      execFileSync("say", ["-r", "165", "-o", aiff, c.text]);
      execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@22050", aiff, wav]);
      rmSync(aiff, { force: true });
      const h = createHash("sha256").update(readFileSync(wav)).digest("hex");
      auManifest[h] = { transcript: c.text, label: c.label, file: c.file };
    } catch {
      console.warn(`   (skipped audio ${c.file}: macOS say/afconvert unavailable — use the transcript box on /ear instead)`);
      auManifest[`text-${c.file}`] = { transcript: c.text, label: c.label, file: c.file };
    }
  }
  writeFileSync(path.join(auDir, "manifest.json"), JSON.stringify(auManifest, null, 2));
  writeFileSync(path.join(auDir, "clips.json"), JSON.stringify(clips.map((c) => ({ file: c.file, label: c.label, transcript: c.text })), null, 2));

  /* ---------- demo accounts (one password for all; override with SEED_PASSWORD) ---------- */
  console.log("→ users");
  const demoPw = process.env.SEED_PASSWORD ?? "eri-demo-2026";
  const passHash = await hashPassword(demoPw);
  const TUNDE_PHONE = "+2348000003402"; // 2nd witness at PU 034 (see submission phones above)
  for (const [email, name, role, phone] of [
    ["admin@eri.demo", "Ada Admin", "admin", null],
    ["observer@eri.demo", "Obi Observer", "observer", null],
    ["amaka@eri.demo", "Amaka", "witness", AMAKA_PHONE],
    ["tunde@eri.demo", "Tunde", "witness", TUNDE_PHONE],
  ] as const) {
    await q("insert into app_user (email, name, role, pass_hash, phone, phone_verified) values ($1,$2,$3,$4,$5,$6)", [email, name, role, passHash, phone, !!phone]);
  }

  /* ---------- cheat sheet for the demo ---------- */
  const sms = (code: string) => encodeResultSms(code, byCode[code].tally);
  writeFileSync(
    path.join(ROOT, "DEMO-DATA.md"),
    `# Ẹ̀rí demo data (synthetic)

- Sign-ins (password \`eri-demo-2026\`): admin@eri.demo · observer@eri.demo · amaka@eri.demo · tunde@eri.demo\n- Amaka (Igbo, basic phone): \`${AMAKA_PHONE}\` — witness at PU ${AMAKA_PU}, Ward 04
- Unwitnessed PUs to fill live: 017 (ward 02), 029 (ward 03)
- SMS for PU 017: \`${sms("017")}\`
- SMS for PU 029: \`${sms("029")}\`
- Bad-checksum example: \`R 017 A${byCode["017"].tally.A} B${byCode["017"].tally.B} C${byCode["017"].tally.C} D${byCode["017"].tally.D} #${checksum("017", { A: 1 }) }\`
- Ward 04 witnessed A total: ${w4True.A} · announced in clip: ${w4Announced.A} (+1,240)
- PU 034 wall A=${byCode[AMAKA_PU].tally.A} → read out at collation A=${amakaChanged.A}
`,
  );

  console.log("→ sanity");
  const [c] = await q<{ n: string }>("select count(*) n from polling_unit");
  console.log(`   ${c.n} polling units, ${nSubs} submissions. Ward 04 A: walls ${w4True.A}, clip announces ${w4Announced.A}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
