import Anthropic from "@anthropic-ai/sdk";
import { PARTIES, PARTY_NAME, type Tally } from "./config";
import { spokenId, wordsToNumber } from "./numbers";
import { openaiEnabled, openaiJson } from "./providers/openai";

export interface ExtractedEntry {
  level: "pu_at_ward" | "ward" | "lga" | "state";
  ward?: number; // ward number
  pu?: string; // 3-digit PU code
  tally?: Tally;
  dropped?: boolean;
}
export interface ExtractContext {
  ward?: number;
}

const STOP = new Set(["party", "ward", "polling", "pu", "lga", "local", "state", "total", "dropped", "cancelled", "canceled", "voided", "excluded", "unit", "collation"]);
const LETTER: Record<string, (typeof PARTIES)[number]> = {
  a: "A", ay: "A", b: "B", bee: "B", c: "C", cee: "C", see: "C", sea: "C", d: "D", dee: "D",
};

/** Party acronyms as the speech recogniser may write them: "apc", or spelled out "a p c". */
const ACRONYMS: { party: (typeof PARTIES)[number]; seqs: string[][] }[] = PARTIES.map((p) => ({
  party: p,
  seqs: [[PARTY_NAME[p].toLowerCase()], PARTY_NAME[p].toLowerCase().split("")],
}));
function acronymAt(toks: string[], i: number): { party: (typeof PARTIES)[number]; len: number } | null {
  for (const { party, seqs } of ACRONYMS)
    for (const seq of seqs) if (seq.every((t, k) => toks[i + k] === t)) return { party, len: seq.length };
  return null;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Rule-based fallback: English words + digits. Works offline and deterministically. */
export function extractRules(transcript: string, ctx: ExtractContext = {}): { entries: ExtractedEntry[]; ctx: ExtractContext } {
  const toks = tokenize(transcript);
  const entries: ExtractedEntry[] = [];
  let cur: ExtractedEntry | null = null;
  let wardCtx = ctx.ward;
  const flush = () => {
    if (cur && (cur.tally || cur.dropped)) entries.push(cur);
    cur = null;
  };
  const id = (from: number): number | null => {
    const slice: string[] = [];
    for (let j = from; j < toks.length && j < from + 4; j++) {
      if (STOP.has(toks[j])) break;
      slice.push(toks[j]);
    }
    return spokenId(slice) ?? wordsToNumber(slice);
  };

  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (w === "ward") {
      const n = id(i + 1);
      if (n !== null) {
        flush();
        wardCtx = n;
        cur = { level: "ward", ward: n };
      }
    } else if (w === "polling" && toks[i + 1] === "unit") {
      const n = id(i + 2);
      if (n !== null) {
        flush();
        cur = { level: "pu_at_ward", pu: String(n).padStart(3, "0"), ward: wardCtx };
      }
    } else if (w === "pu") {
      const n = id(i + 1);
      if (n !== null) {
        flush();
        cur = { level: "pu_at_ward", pu: String(n).padStart(3, "0"), ward: wardCtx };
      }
    } else if (w === "lga" || (w === "local" && toks[i + 1] === "government")) {
      flush();
      cur = { level: "lga" };
    } else if (w === "state" && ["total", "result", "collation", "results"].includes(toks[i + 1])) {
      flush();
      cur = { level: "state" };
    } else if (["dropped", "cancelled", "canceled", "voided", "excluded"].includes(w) && cur?.level === "pu_at_ward") {
      cur.dropped = true;
    } else if (cur) {
      // "party A 3,120" or an acronym: "APC 3,120" / "A P C 3,120"
      let letter: (typeof PARTIES)[number] | undefined;
      let from = i + 1;
      if (w === "party") {
        const ac = acronymAt(toks, i + 1);
        if (ac) {
          letter = ac.party;
          from = i + 1 + ac.len;
        } else {
          letter = LETTER[toks[i + 1]];
          from = i + 2;
        }
      } else {
        const ac = acronymAt(toks, i);
        if (ac) {
          letter = ac.party;
          from = i + ac.len;
        }
      }
      if (letter) {
        const run: string[] = [];
        for (let j = from; j < toks.length; j++) {
          if (STOP.has(toks[j]) || acronymAt(toks, j)) break;
          run.push(toks[j]);
        }
        const n = wordsToNumber(run);
        if (n !== null) cur.tally = { ...(cur.tally ?? {}), [letter]: n };
      }
    }
  }
  flush();
  return { entries, ctx: { ward: wardCtx } };
}

const EXTRACT_PROMPT =
  "You extract election collation announcements from a transcript of a collation officer (ward, LGA or state) reading results aloud (English, Nigerian Pidgin, Hausa, Yoruba or Igbo). " +
  "Parties are APC, LP, NNPP and PDP (they may be spoken as letters, e.g. A P C). In the JSON use the keys A=APC, B=LP, C=NNPP, D=PDP. Return ONLY a JSON array. Each item: " +
  '{"level":"pu_at_ward"|"ward"|"lga"|"state","ward":<number|null>,"pu":"<3-digit string|null>","tally":{"A":n,"B":n,...},"dropped":<bool>}. ' +
  "Use level pu_at_ward for a single polling unit line read at ward collation, ward for a ward total, lga for an LGA total, state for a state total. " +
  "Set dropped=true only if the officer says a polling unit result is cancelled/dropped/excluded. Never invent figures.";

type Raw = { level: ExtractedEntry["level"]; ward?: number | null; pu?: string | null; tally?: Tally; dropped?: boolean };

function toEntries(arr: Raw[]): ExtractedEntry[] {
  return arr.map((e) => ({
    level: e.level,
    ward: e.ward ?? undefined,
    pu: e.pu ? String(e.pu).padStart(3, "0") : undefined,
    tally: e.tally,
    dropped: e.dropped,
  }));
}

const userMsg = (transcript: string, ctx: ExtractContext) => `Current ward context: ${ctx.ward ?? "unknown"}\nTranscript:\n${transcript}`;

/** LLM path: handles Pidgin / Hausa / Yoruba / Igbo number words and messy transcripts. */
async function extractClaude(transcript: string, ctx: ExtractContext): Promise<ExtractedEntry[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 1500,
    system: EXTRACT_PROMPT,
    messages: [{ role: "user", content: userMsg(transcript, ctx) }],
  });
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return toEntries(JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] ?? "[]") as Raw[]);
}

/** OpenAI JSON mode returns an object, so the array is requested under "entries". */
async function extractOpenAI(transcript: string, ctx: ExtractContext): Promise<ExtractedEntry[]> {
  const out = (await openaiJson(
    EXTRACT_PROMPT.replace("Return ONLY a JSON array. Each item:", 'Return ONLY a JSON object {"entries":[...]}. Each item of entries:'),
    userMsg(transcript, ctx),
    1500,
  )) as { entries?: Raw[] };
  return toEntries(out.entries ?? []);
}

export async function extractFigures(transcript: string, ctx: ExtractContext = {}) {
  const engine = process.env.ANTHROPIC_API_KEY ? ("claude" as const) : openaiEnabled() ? ("openai" as const) : null;
  if (engine) {
    try {
      const entries = engine === "claude" ? await extractClaude(transcript, ctx) : await extractOpenAI(transcript, ctx);
      const ward = [...entries].reverse().find((e) => e.ward)?.ward ?? ctx.ward;
      return { entries, ctx: { ward }, engine };
    } catch {
      /* fall through to rules */
    }
  }
  return { ...extractRules(transcript, ctx), engine: "rules" as const };
}
