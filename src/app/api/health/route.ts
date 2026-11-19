import { clientIp, rateLimited } from "@/lib/auth";
import { dbUrlMissing, q1 } from "@/lib/db";
import { json } from "@/lib/http";

// Public deploy check. Open /api/health after deploying: it says what is missing without revealing any secret or host.
export async function GET(req: Request) {
  if (rateLimited(`health:${clientIp(req)}`, 30, 60_000)) return json({ error: "Too many requests" }, 429);

  const checks = {
    databaseUrlSet: !dbUrlMissing(),
    authSecretSet: !!process.env.AUTH_SECRET,
    database: "unknown" as "up" | "down" | "unknown",
    seeded: false,
    hint: "" as string,
  };

  if (!checks.databaseUrlSet) {
    checks.database = "down";
    checks.hint = "DATABASE_URL is not set on the host.";
  } else {
    try {
      const r = await q1<{ n: string }>("select count(*) as n from polling_unit");
      checks.database = "up";
      checks.seeded = Number(r?.n ?? 0) > 0;
      if (!checks.seeded) checks.hint = "Database is reachable but empty. Run the seed against it (see README → Deploy).";
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code === "42P01") {
        checks.database = "up";
        checks.hint = "Database is reachable but the tables are missing. Run the seed against it (see README → Deploy).";
      } else {
        checks.database = "down";
        checks.hint = `Cannot reach the database${code ? ` (${code})` : ""}. Check DATABASE_URL and that the database allows connections from the host (use sslmode=require).`;
      }
    }
  }
  if (!checks.authSecretSet && !checks.hint) checks.hint = "AUTH_SECRET is not set: sessions will not survive across serverless instances.";

  const ok = checks.database === "up" && checks.seeded && checks.authSecretSet;
  return json({ ok, ...checks }, ok ? 200 : 503);
}
