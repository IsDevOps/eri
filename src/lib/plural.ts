/** "1 witness" / "3 witnesses". */
export const wit = (n: number): string => `${n} witness${n === 1 ? "" : "es"}`;
/** "1 witness agrees" / "3 witnesses agree" (the verb is given in its plural form). */
export const witVerb = (n: number, verb = "agree"): string => `${wit(n)} ${n === 1 ? verb + "s" : verb}`;
