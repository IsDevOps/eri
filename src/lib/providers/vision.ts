import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PARTIES, type Tally } from "../config";

/**
 * EC8A photo reader.
 *  - ANTHROPIC_API_KEY set -> Claude vision reads the handwritten sheet
 *  - otherwise             -> simulator: SHA-256 lookup in public/demo/ec8a/manifest.json
 */
export interface SheetReading {
  puCode: string | null;
  tally: Tally;
  confidence: number;
  engine: "claude" | "simulator";
  note?: string;
}

export function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function readSheet(img: Buffer, mime: string): Promise<SheetReading> {
  if (process.env.ANTHROPIC_API_KEY) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-5-5",
      max_tokens: 400,
      system:
        "You read photographs of Nigerian INEC Form EC8A polling-unit result sheets. Return ONLY JSON: " +
        '{"pu_code":"<3-digit string or null>","votes":{"A":n,"B":n,"C":n,"D":n},"confidence":<0-1>,"note":"<short>"}. ' +
        "Read the handwritten figures exactly as written. If a figure is illegible use null for it and lower confidence. Never guess.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mime as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: img.toString("base64") },
            },
            { type: "text", text: "Read this result sheet." },
          ],
        },
      ],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      pu_code?: string | null;
      votes?: Record<string, number | null>;
      confidence?: number;
      note?: string;
    };
    const tally: Tally = {};
    for (const p of PARTIES) if (typeof json.votes?.[p] === "number") tally[p] = json.votes![p]!;
    return {
      puCode: json.pu_code ? String(json.pu_code).padStart(3, "0") : null,
      tally,
      confidence: json.confidence ?? 0.5,
      engine: "claude",
      note: json.note,
    };
  }
  const hash = sha256(img);
  try {
    const manifest = JSON.parse(
      await readFile(path.join(process.cwd(), "public/demo/ec8a/manifest.json"), "utf8"),
    ) as Record<string, { pu: string; tally: Tally; note?: string }>;
    const hit = manifest[hash];
    if (hit) return { puCode: hit.pu, tally: hit.tally, confidence: 0.97, engine: "simulator", note: hit.note };
  } catch {
    /* no manifest */
  }
  throw new Error("No vision provider configured and this image is not a known demo sheet. Set ANTHROPIC_API_KEY.");
}
