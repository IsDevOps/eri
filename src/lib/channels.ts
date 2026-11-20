import { LANGS, PARTIES, USSD_CODE, partyFrom, tallyText, type Lang, type Tally } from "./config";
import { t } from "./i18n";
import { sendMessage } from "./providers/sms";
import { checksum } from "./sms-codec";
import { parseResultSms } from "./sms-codec";
import { normPhone, setLang, setVoice, submitResult, ussdCheck, witnessLang } from "./services";

const tallyStr = (tl: Tally) => PARTIES.filter((p) => tl[p] !== undefined).map((p) => `${p}${tl[p]}`).join(" ");

/** Inbound SMS to the shortcode. Returns the reply text (also queued to the sender's phone). */
export async function handleSms(fromRaw: string, text: string): Promise<string> {
  const from = normPhone(fromRaw);
  const lang = await witnessLang(from);
  const body = text.trim();
  let reply: string;
  let replyLang: Lang = lang;

  const langCmd = body.toUpperCase().match(/^LANG\s+(EN|PCM|HA|YO|IG)$/);
  if (langCmd) {
    replyLang = langCmd[1].toLowerCase() as Lang;
    if (!LANGS.includes(replyLang)) replyLang = "en";
    await setLang(from, replyLang);
    reply = t("sms_lang_set", replyLang);
  } else if (/^VOICE\s+(ON|OFF)$/i.test(body)) {
    const on = /ON$/i.test(body);
    await setVoice(from, on);
    reply = on ? "Eri: Voice alerts ON. You will also get a call in your language." : "Eri: Voice alerts OFF.";
  } else if (/^R\b/i.test(body)) {
    const parsed = parseResultSms(body);
    if (parsed.ok) {
      const res = await submitResult({ puCode: parsed.puCode, tally: parsed.tally, phone: from, source: "sms", raw: body });
      reply = res.ok
        ? t("sms_ack", lang, { pu: parsed.puCode, tally: tallyText(parsed.tally, " "), agree: res.agree, ussd: USSD_CODE })
        : t("sms_unknown_pu", lang, { pu: parsed.puCode });
    } else if (parsed.reason === "checksum" && parsed.puCode) {
      // Echo back the corrected message so a garbled 2G text is cheap to fix.
      const m = body.toUpperCase().match(/^R\s*\d{1,3}\s+((?:[A-Z]{1,6}\d+\s*)+)#/);
      const tally: Tally = {};
      for (const tok of (m?.[1] ?? "").trim().split(/\s+/)) {
        const tm = tok.match(/^([A-Z]+)(\d+)$/);
        const p = tm ? partyFrom(tm[1]) : null;
        if (tm && p) tally[p] = parseInt(tm[2], 10);
      }
      const fixed = `R ${parsed.puCode} ${tallyStr(tally)} #${checksum(parsed.puCode, tally)}`;
      reply = t("sms_bad_checksum", lang, { expected: fixed });
    } else {
      reply = t("sms_bad_format", lang);
    }
  } else {
    reply = t("sms_bad_format", lang);
  }
  await sendMessage({ to: from, body: reply, lang: replyLang });
  return reply;
}

/** USSD session (Africa's Talking shape). `text` is the *-joined input so far. */
export async function handleUssd(phoneRaw: string, text: string): Promise<string> {
  const phone = normPhone(phoneRaw);
  const lang = await witnessLang(phone);
  const last = text.split("*").filter(Boolean).pop();
  if (!last) return `CON ${t("ussd_prompt", lang)}`;
  return `END ${await ussdCheck(last, lang)}`;
}
