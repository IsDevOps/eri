import { guard } from "@/lib/auth";
import { LANGS, type Lang } from "@/lib/config";
import { json } from "@/lib/http";
import { ingestPhoto, normPhone, setLang } from "@/lib/services";

// Web / WhatsApp-bot upload of an EC8A photo. AI reads the handwriting so nobody types figures.
// A witness always submits as themselves (verified phone from the session); only an admin (the phone simulator) may name a phone.
export const POST = guard(["witness", "admin"], async (req, _ctx, user) => {
  const fd = await req.formData();
  const file = fd.get("file");
  const source = fd.get("source") === "photo" ? "photo" : "whatsapp";
  const lang = String(fd.get("lang") ?? "") as Lang;
  let phone: string;
  if (user.role === "witness") {
    if (!user.phone || !user.phoneVerified) return json({ ok: false, error: "Verify your phone number before submitting results." }, 403);
    phone = user.phone;
  } else {
    phone = normPhone(String(fd.get("phone") ?? ""));
  }
  if (!(file instanceof File) || !phone) return json({ error: "file and phone required" }, 400);
  if (file.size > 8 * 1024 * 1024) return json({ ok: false, error: "Photo is larger than 8 MB." }, 413);
  try {
    if (LANGS.includes(lang)) await setLang(phone, lang);
    const buf = Buffer.from(await file.arrayBuffer());
    return json(await ingestPhoto(buf, file.type || "image/png", phone, source, LANGS.includes(lang) ? lang : undefined));
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 422);
  }
});
