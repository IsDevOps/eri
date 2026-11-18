import { clientIp, rateLimited } from "@/lib/auth";
import { json } from "@/lib/http";
import { checkImage } from "@/lib/services";

// Public, read-only fake-result checker: forwarding an image never exposes witness identities or stores the upload.
export async function POST(req: Request) {
  if (rateLimited(`image-check:${clientIp(req)}`, 10, 60_000)) return json({ verdict: "error", message: "Too many image checks. Please try again in a minute." }, 429);
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return json({ error: "file required" }, 400);
  if (!(["image/png", "image/jpeg", "image/webp"] as string[]).includes(file.type) || file.size > 8 * 1024 * 1024)
    return json({ error: "Choose a PNG, JPEG, or WebP image smaller than 8 MB." }, 400);
  try {
    return json(await checkImage(Buffer.from(await file.arrayBuffer()), file.type || "image/png"));
  } catch (e) {
    return json({ verdict: "error", message: (e as Error).message }, 422);
  }
}
