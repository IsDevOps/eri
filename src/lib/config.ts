// Parties on the result sheet. They are managed by an admin (Admin → Parties) and stored in the `party` table; this module
// holds the live list so every formatter and form can read it synchronously. The server refreshes it from the database
// (see db.ts) and the browser receives it from the root layout (see components/PartyBoot.tsx).
//
// Each party has a one-letter internal key (A, B, C, ...) so the SMS format stays short (R 012 A120 B85 C40 #7F3) and stored
// results keep their shape; everything a person reads uses the acronym (see partyName / tallyText).
export type Party = string;
export type Tally = Partial<Record<Party, number>>;
export interface PartyDef {
  key: string;
  acronym: string;
  name: string;
}

/** INEC-registered parties tracked out of the box, in INEC's alphabetical order. */
export const DEFAULT_PARTIES: PartyDef[] = [
  { key: "A", acronym: "APC", name: "All Progressives Congress" },
  { key: "B", acronym: "LP", name: "Labour Party" },
  { key: "C", acronym: "NNPP", name: "New Nigeria Peoples Party" },
  { key: "D", acronym: "PDP", name: "Peoples Democratic Party" },
];

/** Live lists, mutated in place by setParties so every importer sees the change. */
export const PARTIES: string[] = [];
export const PARTY_NAME: Record<string, string> = {};
export const PARTY_FULL: Record<string, string> = {};

export function setParties(defs: PartyDef[]) {
  PARTIES.length = 0;
  for (const k of Object.keys(PARTY_NAME)) delete PARTY_NAME[k];
  for (const k of Object.keys(PARTY_FULL)) delete PARTY_FULL[k];
  for (const d of defs) {
    PARTIES.push(d.key);
    PARTY_NAME[d.key] = d.acronym;
    PARTY_FULL[d.key] = d.name;
  }
}
export const currentParties = (): PartyDef[] => PARTIES.map((key) => ({ key, acronym: PARTY_NAME[key], name: PARTY_FULL[key] }));
setParties(DEFAULT_PARTIES);

export const MAX_PARTIES = 20;
export const partyName = (p: string): string => PARTY_NAME[p] ?? p;
/** Accepts a letter key (A, B, ...) or an acronym (APC, LP, NNPP, PDP, ...), any case. */
export function partyFrom(token: string): Party | null {
  const t = token.trim().toUpperCase();
  if (PARTIES.includes(t)) return t;
  return PARTIES.find((p) => PARTY_NAME[p] === t) ?? null;
}
/** Human-readable tally: "APC 175 · LP 129 · NNPP 81 · PDP 31". */
export const tallyText = (t: Tally, sep = " · "): string => PARTIES.filter((p) => t[p] !== undefined).map((p) => `${PARTY_NAME[p]} ${t[p]}`).join(sep);
/** "APC, LP, NNPP and PDP" */
export const partyList = (): string => {
  const names = PARTIES.map((p) => PARTY_NAME[p]);
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

export const SHORTCODE = "32737"; // SMS shortcode
export const USSD_CODE = "*347*PU#"; // USSD service code

export const LANGS = ["en", "pcm", "ha", "yo", "ig"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  pcm: "Pidgin",
  ha: "Hausa",
  yo: "Yorùbá",
  ig: "Igbo",
};

export function emptyTally(): Record<Party, number> {
  return Object.fromEntries(PARTIES.map((p) => [p, 0]));
}

export function tallyTotal(t: Tally): number {
  return PARTIES.reduce((s, p) => s + (t[p] ?? 0), 0);
}

export function tallyEq(a: Tally, b: Tally): boolean {
  return PARTIES.every((p) => (a[p] ?? 0) === (b[p] ?? 0));
}

export function tallyKey(t: Tally): string {
  return PARTIES.map((p) => `${p}${t[p] ?? 0}`).join(" ");
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Validation shared by the admin API and the form: 2–6 letters, upper-cased. */
export const ACRONYM_RE = /^[A-Z]{2,6}$/;
/** Next free one-letter key, or null when all 26 are taken. */
export function nextPartyKey(used: string[]): string | null {
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i);
    if (!used.includes(k)) return k;
  }
  return null;
}
