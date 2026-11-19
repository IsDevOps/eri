// Parties on the result sheet. The four columns tracked here are registered INEC parties, in INEC's alphabetical order.
// The internal keys stay the letters A–D so the SMS format stays short (R 012 A120 B85 C40 #7F3) and stored results keep their shape;
// everything a person reads uses the party acronym (see partyName / tallyText).
export const PARTIES = ["A", "B", "C", "D"] as const;
export type Party = (typeof PARTIES)[number];
export type Tally = Partial<Record<Party, number>>;

export const PARTY_NAME: Record<Party, string> = { A: "APC", B: "LP", C: "NNPP", D: "PDP" };
export const PARTY_FULL: Record<Party, string> = {
  A: "All Progressives Congress",
  B: "Labour Party",
  C: "New Nigeria Peoples Party",
  D: "Peoples Democratic Party",
};
export const partyName = (p: string): string => PARTY_NAME[p as Party] ?? p;
/** Accepts a letter code (A–D) or an acronym (APC, LP, NNPP, PDP), any case. */
export function partyFrom(token: string): Party | null {
  const t = token.trim().toUpperCase();
  if ((PARTIES as readonly string[]).includes(t)) return t as Party;
  return (PARTIES.find((p) => PARTY_NAME[p] === t) as Party | undefined) ?? null;
}
/** Human-readable tally: "APC 175 · LP 129 · NNPP 81 · PDP 31". */
export const tallyText = (t: Tally, sep = " · "): string => PARTIES.filter((p) => t[p] !== undefined).map((p) => `${PARTY_NAME[p]} ${t[p]}`).join(sep);

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
  return { A: 0, B: 0, C: 0, D: 0 };
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
