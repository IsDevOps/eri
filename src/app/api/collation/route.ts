import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { recordCollation } from "@/lib/services";
import type { ExtractedEntry } from "@/lib/extract";

// Manual entry of an announced collation figure (EC8B/C/D) — e.g. from a journalist's notes.
async function handle(req: Request) {
  const e = (await req.json()) as ExtractedEntry;
  return json(await recordCollation(e, { source: "manual" }));
}

export const POST = guard(["admin", "observer"], (req) => handle(req));
