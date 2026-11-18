import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { checkImage } from "@/lib/services";

// Fake-result checker: forward a viral "result sheet" image, get a verdict against the witnesses.
async function handle(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ error: "file required" }, 400);
  try {
    return json(await checkImage(Buffer.from(await file.arrayBuffer()), file.type || "image/png"));
  } catch (e) {
    return json({ verdict: "error", message: (e as Error).message }, 422);
  }
}

export const POST = guard("any", (req) => handle(req));
