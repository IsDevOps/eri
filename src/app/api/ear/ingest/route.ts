import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { extractFigures, type ExtractContext } from "@/lib/extract";
import { recordCollation } from "@/lib/services";
import { buildTree } from "@/lib/reconcile";

// Live Ear: transcript chunk -> figures per ward/LGA/PU -> recorded as a collation hop -> reconciled instantly.
async function handle(req: Request) {
  const { transcript, ctx } = (await req.json()) as { transcript: string; ctx?: ExtractContext };
  if (!transcript?.trim()) return json({ error: "transcript required" }, 400);
  const out = await extractFigures(transcript, ctx ?? {});
  const results = [];
  const alerts = [];
  for (const e of out.entries) {
    const r = await recordCollation(e, { source: "audio", transcript });
    results.push({ entry: e, result: r });
    if ("alerts" in r && r.alerts) alerts.push(...r.alerts);
  }
  return json({ engine: out.engine, ctx: out.ctx, entries: results, alerts, tree: await buildTree() });
}

export const POST = guard(["admin", "observer"], (req) => handle(req));
