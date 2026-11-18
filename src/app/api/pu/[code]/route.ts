import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { puNode } from "@/lib/services";

async function handle(ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const n = await puNode(code.padStart(3, "0"));
  return n ? json(n) : json({ error: "not found" }, 404);
}

export const GET = guard<{ params: Promise<{ code: string }> }>("any", (_req, ctx) => handle(ctx));
