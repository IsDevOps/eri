import { guard } from "@/lib/auth";
import { json } from "@/lib/http";
import { transcribe } from "@/lib/providers/stt";

async function handle(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ error: "file required" }, 400);
  try {
    return json(await transcribe(Buffer.from(await file.arrayBuffer()), file.name || "audio.wav", file.type || "audio/wav"));
  } catch (e) {
    return json({ error: (e as Error).message }, 422);
  }
}

export const POST = guard(["admin", "observer"], (req) => handle(req));
