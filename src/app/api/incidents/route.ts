import { clientIp, rateLimited, sameOrigin } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { json } from "@/lib/http";

const CATEGORIES = new Set(["violence", "vote_buying", "delay", "access", "other"]);

/**
 * Public, deliberately low-risk incident intake. Reports are private audit events and
 * always unverified; the app does not turn a single allegation into a public claim.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Cross-site request refused." }, 403);
  if (rateLimited(`incident:${clientIp(req)}`, 3, 15 * 60_000)) return json({ error: "Too many reports from this connection. Please try again in a few minutes." }, 429);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rawPu = String(body.pu ?? "").replace(/\D/g, "");
  const pu = rawPu.padStart(3, "0");
  const category = String(body.category ?? "");
  const details = String(body.details ?? "").replace(/\s+/g, " ").trim();

  if (!/^\d{1,3}$/.test(rawPu)) return json({ error: "Enter the three-digit polling-unit code." }, 400);
  if (!CATEGORIES.has(category)) return json({ error: "Choose a report category." }, 400);
  if (details.length < 20 || details.length > 500) return json({ error: "Please keep the description between 20 and 500 characters." }, 400);
  const knownPu = await q1<{ code: string }>("select code from polling_unit where code=$1", [pu]);
  if (!knownPu) return json({ error: `No polling unit with code ${pu}.` }, 404);

  const row = await q1<{ id: number }>("insert into audit_log (event, detail) values ('incident_report', $1) returning id", [JSON.stringify({ pu, category, details, status: "unverified" })]);
  return json({ ok: true, id: row?.id });
}
