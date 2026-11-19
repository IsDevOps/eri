import { createHash } from "node:crypto";
import { PARTIES, partyFrom, type Tally } from "./config";

/**
 * SMS result format:  R 012 A120 B85 C40 D7 #7F3
 *   R        = result marker
 *   012      = polling-unit code
 *   A120 ... = party + votes (missing parties count as 0). Party acronyms work too: APC120 LP85 NNPP40 PDP7
 *   #7F3     = 3-hex checksum over the canonical payload, so a garbled 2G message is rejected
 */
export function checksum(puCode: string, tally: Tally): string {
  const canon = puCode + PARTIES.map((p) => `${p}${tally[p] ?? 0}`).join("");
  return createHash("sha1").update(canon).digest("hex").slice(0, 3).toUpperCase();
}

export function encodeResultSms(puCode: string, tally: Tally): string {
  const parts = PARTIES.filter((p) => (tally[p] ?? 0) > 0 || p === "A").map((p) => `${p}${tally[p] ?? 0}`);
  return `R ${puCode} ${parts.join(" ")} #${checksum(puCode, tally)}`;
}

export type ParsedSms =
  | { ok: true; puCode: string; tally: Tally }
  | { ok: false; reason: "format" | "checksum" | "party"; puCode?: string; expected?: string };

export function parseResultSms(text: string): ParsedSms {
  const t = text.trim().replace(/\s+/g, " ").toUpperCase();
  const m = t.match(/^R (\d{1,3}) ((?:[A-Z]{1,4}\d+ ?)+)#([0-9A-F]{3})$/);
  if (!m) return { ok: false, reason: "format" };
  const puCode = m[1].padStart(3, "0");
  const tally: Tally = {};
  for (const tok of m[2].trim().split(" ")) {
    const tm = tok.match(/^([A-Z]+)(\d+)$/);
    const party = tm ? partyFrom(tm[1]) : null;
    if (!tm || !party) return { ok: false, reason: "party", puCode };
    tally[party] = parseInt(tm[2], 10);
  }
  const expected = checksum(puCode, tally);
  if (expected !== m[3]) return { ok: false, reason: "checksum", puCode, expected };
  return { ok: true, puCode, tally };
}
