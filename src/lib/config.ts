// Synthetic, strictly non-partisan demo configuration.
// Parties are neutral letters so the SMS format stays short: R 012 A120 B85 C40 #7F3
export const PARTIES = ["A", "B", "C", "D"] as const;
export type Party = (typeof PARTIES)[number];
export type Tally = Partial<Record<Party, number>>;

export const SHORTCODE = "32737"; // demo SMS shortcode
export const USSD_CODE = "*347*PU#"; // demo USSD service code

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
