import { getPartyDefs } from "@/lib/db";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

// Public: the parties on the result sheet (acronym and full name are not secret).
export async function GET() {
  return json(await getPartyDefs());
}
