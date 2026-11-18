// Spoken-English number parser ("three thousand one hundred and twenty" -> 3120)
// plus digit passthrough. Used by the rule-based fallback in extract.ts; the LLM path
// handles Pidgin / Hausa / Yoruba / Igbo numerals when ANTHROPIC_API_KEY is set.
const UNITS: Record<string, number> = {
  zero: 0, oh: 0, o: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Parse a run of number words into an integer. Returns null if no number found. */
export function wordsToNumber(tokens: string[]): number | null {
  let total = 0;
  let current = 0;
  let seen = false;
  for (const raw of tokens) {
    const w = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!w || w === "and") continue;
    if (/^\d+$/.test(w)) {
      current += parseInt(w, 10);
      seen = true;
    } else if (w in UNITS) {
      current += UNITS[w];
      seen = true;
    } else if (w in TENS) {
      current += TENS[w];
      seen = true;
    } else if (w === "hundred") {
      current = (current || 1) * 100;
      seen = true;
    } else if (w === "thousand") {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else if (w === "million") {
      total += (current || 1) * 1_000_000;
      current = 0;
      seen = true;
    } else {
      break;
    }
  }
  return seen ? total + current : null;
}

/** "zero four" / "04" / "four" -> 4  (ward & PU identifiers are read digit by digit) */
export function spokenId(tokens: string[]): number | null {
  const digits: string[] = [];
  for (const raw of tokens) {
    const w = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (/^\d+$/.test(w)) digits.push(w);
    else if (w in UNITS && UNITS[w] < 10) digits.push(String(UNITS[w]));
    else if (w === "and" || !w) continue;
    else break;
  }
  return digits.length ? parseInt(digits.join(""), 10) : null;
}
