import type { Lang } from "./config";

/**
 * Witness Alarm + USSD + SMS-ack strings.
 * NOTE: Hausa / Yorùbá / Igbo / Pidgin copy is a working draft and must be
 * reviewed by native speakers before any real-world use.
 */
type Vars = Record<string, string | number>;
type Dict = Record<string, Record<Lang, string>>;

const D: Dict = {
  // ---- Witness Alarm (SMS / voice script) ----
  alarm_pu_changed: {
    en: "Eri: Your PU ({pu}, Ward {ward}) result was changed at ward collation. Your EC8A: {ec8a}. Read out: {read}. Dial {ussd} for proof.",
    pcm: "Eri: Dem don change your PU ({pu}, Ward {ward}) result for ward collation. Wetin you see: {ec8a}. Wetin dem read: {read}. Dial {ussd} see proof.",
    ha: "Eri: An canza sakamakon rumfar zabenku ({pu}, Mazaba {ward}) a wurin tattara sakamakon mazaba. Abin da kuka gani: {ec8a}. Abin da aka karanta: {read}. Kira {ussd} don ganin hujja.",
    yo: "Eri: A ti yi esi ibudo idibo yin ({pu}, Wodu {ward}) pada ni ikojopo wodu. Ohun ti e ri: {ec8a}. Ohun ti won ka: {read}. Pe {ussd} fun eri.",
    ig: "Eri: Agbanweela nsonaazu ulo ntuli aka gi ({pu}, Woodu {ward}) n'oge nchikota woodu. Ihe i hurụ: {ec8a}. Ihe ha gụrụ: {read}. Kpoo {ussd} maka ihe ama.",
  },
  alarm_pu_dropped: {
    en: "Eri: Your PU ({pu}, Ward {ward}) result was DROPPED at ward collation. It is missing from the count. Dial {ussd} for proof.",
    pcm: "Eri: Dem DROP your PU ({pu}, Ward {ward}) result for ward collation. E no dey inside the count. Dial {ussd} see proof.",
    ha: "Eri: An JEFAR da sakamakon rumfar zabenku ({pu}, Mazaba {ward}) a tattarawar mazaba. Babu shi a cikin kirgen. Kira {ussd} don hujja.",
    yo: "Eri: A DA esi ibudo idibo yin ({pu}, Wodu {ward}) sile ni ikojopo wodu. Ko si ninu iye. Pe {ussd} fun eri.",
    ig: "Eri: Wepuru nsonaazu ulo ntuli aka gi ({pu}, Woodu {ward}) n'nchikota woodu. O adighi na ngụkọta. Kpoo {ussd} maka ihe ama.",
  },
  alarm_ward_inflated: {
    en: "Eri: Ward {ward} announced {party} {announced}. Its witnessed polling units posted {ec8asum}. {gap} votes unexplained. Your PU ({pu}) EC8A is part of this. Dial {ussd}.",
    pcm: "Eri: Ward {ward} announce {party} {announced}. Wetin the PUs wey witness post na {ec8asum}. {gap} votes no get explanation. Your PU ({pu}) dey inside. Dial {ussd}.",
    ha: "Eri: Mazaba {ward} ta sanar da {party} {announced}. Rumfunan da aka shaida sun aika {ec8asum}. Kuri'u {gap} ba a bayyana ba. Rumfarku ({pu}) tana ciki. Kira {ussd}.",
    yo: "Eri: Wodu {ward} kede {party} {announced}. Awon ibudo ti a jerii fi ranse {ec8asum}. Ibo {gap} ko ni alaye. Ibudo yin ({pu}) wa ninu re. Pe {ussd}.",
    ig: "Eri: Woodu {ward} kwuputara {party} {announced}. Ulo ntuli aka ndi a hụrụ zitere {ec8asum}. Votu {gap} enweghi nkowa. Ulo gi ({pu}) so na ya. Kpoo {ussd}.",
  },
  alarm_lga_mismatch: {
    en: "Eri: LGA total for {party} ({announced}) does not equal the sum of its wards ({ec8asum}). Your PU ({pu}) is in this LGA. Dial {ussd}.",
    pcm: "Eri: LGA total for {party} ({announced}) no match the sum of im wards ({ec8asum}). Your PU ({pu}) dey inside. Dial {ussd}.",
    ha: "Eri: Jimillar karamar hukuma ta {party} ({announced}) bai yi daidai da jimillar mazabunta ba ({ec8asum}). Rumfarku ({pu}) tana ciki. Kira {ussd}.",
    yo: "Eri: Apapo LGA fun {party} ({announced}) ko dogba pelu apapo wodu re ({ec8asum}). Ibudo yin ({pu}) wa ninu re. Pe {ussd}.",
    ig: "Eri: Nchikota LGA maka {party} ({announced}) adighi hara nke woodu ya ({ec8asum}). Ulo gi ({pu}) no na ya. Kpoo {ussd}.",
  },
  // ---- SMS acknowledgements ----
  sms_ack: {
    en: "Eri: PU {pu} recorded: {tally}. {agree} witness(es) agree. Dial {ussd} anytime to check it.",
    pcm: "Eri: PU {pu} don enter: {tally}. {agree} witness agree. Dial {ussd} anytime check am.",
    ha: "Eri: An adana rumfa {pu}: {tally}. Shaidu {agree} sun yarda. Kira {ussd} a kowane lokaci.",
    yo: "Eri: A ti gba ibudo {pu}: {tally}. Elerii {agree} fohun. Pe {ussd} nigbakugba.",
    ig: "Eri: Edebere ulo {pu}: {tally}. Ndi akaebe {agree} kwenyere. Kpoo {ussd} oge obula.",
  },
  sms_bad_checksum: {
    en: "Eri: Message garbled (checksum mismatch). Please resend: {expected}",
    pcm: "Eri: Message scatter (checksum no match). Abeg send am again: {expected}",
    ha: "Eri: Saƙon ya lalace (checksum bai dace ba). Don Allah sake aikawa: {expected}",
    yo: "Eri: Ifiranse ti baje (checksum ko ba mu). Jowo tun fi ranse: {expected}",
    ig: "Eri: Ozi mebiri emebi (checksum adaghi). Biko zighachi: {expected}",
  },
  sms_bad_format: {
    en: "Eri: Format: R <PU> A120 B85 C40 #<check>. Example: R 012 A120 B85 #7F3",
    pcm: "Eri: Format: R <PU> A120 B85 C40 #<check>. Example: R 012 A120 B85 #7F3",
    ha: "Eri: Tsari: R <PU> A120 B85 C40 #<check>. Misali: R 012 A120 B85 #7F3",
    yo: "Eri: Ilana: R <PU> A120 B85 C40 #<check>. Apeere: R 012 A120 B85 #7F3",
    ig: "Eri: Usoro: R <PU> A120 B85 C40 #<check>. Ihe atu: R 012 A120 B85 #7F3",
  },
  sms_unknown_pu: {
    en: "Eri: Unknown polling unit {pu}. Check the code on your EC8A.",
    pcm: "Eri: We no know PU {pu}. Check the code for your EC8A.",
    ha: "Eri: Ba a san rumfar zabe {pu} ba. Duba lambar a EC8A.",
    yo: "Eri: A ko mo ibudo idibo {pu}. Wo koodu lori EC8A yin.",
    ig: "Eri: Amaghi ulo ntuli aka {pu}. Lee koodu na EC8A gi.",
  },
  sms_lang_set: {
    en: "Eri: Language set to English. You will get alerts in English.",
    pcm: "Eri: Language don set to Pidgin. Alerts go come for Pidgin.",
    ha: "Eri: An saita harshe zuwa Hausa. Za ku samu sanarwa da Hausa.",
    yo: "Eri: A ti ya ede si Yoruba. Iroyin yoo wa ni Yoruba.",
    ig: "Eri: Edoro asusu na Igbo. Ihe ngosi ga-abu n'Igbo.",
  },
  // ---- USSD ----
  ussd_prompt: {
    en: "Eri - check your PU\nEnter PU code (e.g. 012):",
    pcm: "Eri - check your PU\nEnter PU code (e.g. 012):",
    ha: "Eri - duba rumfarku\nShigar da lambar rumfa (misali 012):",
    yo: "Eri - se ayewo ibudo yin\nTe koodu ibudo (apeere 012):",
    ig: "Eri - lee ulo gi\nKpoo koodu ulo (dika 012):",
  },
  ussd_unknown: {
    en: "PU {pu} not found.",
    pcm: "We no see PU {pu}.",
    ha: "Ba a sami rumfa {pu} ba.",
    yo: "A ko ri ibudo {pu}.",
    ig: "Achoghi ulo {pu}.",
  },
  ussd_none: {
    en: "PU {pu} (Ward {ward}): no witness result yet.",
    pcm: "PU {pu} (Ward {ward}): nobody don post result yet.",
    ha: "Rumfa {pu} (Mazaba {ward}): babu sakamakon shaida tukuna.",
    yo: "Ibudo {pu} (Wodu {ward}): ko tii si esi elerii.",
    ig: "Ulo {pu} (Woodu {ward}): enwebeghi nsonaazu onye akaebe.",
  },
  ussd_verified: {
    en: "PU {pu} (Ward {ward}): {n} witnesses agree. Matches collation. {tally}",
    pcm: "PU {pu} (Ward {ward}): {n} witness agree. E match collation. {tally}",
    ha: "Rumfa {pu} (Mazaba {ward}): shaidu {n} sun yarda. Ya yi daidai da tattara. {tally}",
    yo: "Ibudo {pu} (Wodu {ward}): elerii {n} fohun. O ba ikojopo mu. {tally}",
    ig: "Ulo {pu} (Woodu {ward}): ndi akaebe {n} kwenyere. O kwere n'nchikota. {tally}",
  },
  ussd_pending: {
    en: "PU {pu} (Ward {ward}): {n} witnesses agree. Not yet read at ward collation. {tally}",
    pcm: "PU {pu} (Ward {ward}): {n} witness agree. Dem never read am for ward collation. {tally}",
    ha: "Rumfa {pu} (Mazaba {ward}): shaidu {n} sun yarda. Ba a karanta a tattara ba tukuna. {tally}",
    yo: "Ibudo {pu} (Wodu {ward}): elerii {n} fohun. A ko ti ka ni ikojopo. {tally}",
    ig: "Ulo {pu} (Woodu {ward}): ndi akaebe {n} kwenyere. Agughi n'nchikota. {tally}",
  },
  ussd_changed: {
    en: "ALERT PU {pu} (Ward {ward}): EC8A {ec8a}, but ward collation read {read}. {n} witnesses.",
    pcm: "ALERT PU {pu} (Ward {ward}): EC8A na {ec8a}, but ward collation read {read}. {n} witness.",
    ha: "GARGADI Rumfa {pu} (Mazaba {ward}): EC8A {ec8a}, amma tattarawa ta karanta {read}. Shaidu {n}.",
    yo: "IKILO Ibudo {pu} (Wodu {ward}): EC8A {ec8a}, sugbon ikojopo ka {read}. Elerii {n}.",
    ig: "ENYEMAKA Ulo {pu} (Woodu {ward}): EC8A {ec8a}, mana nchikota gụrụ {read}. Ndi akaebe {n}.",
  },
  ussd_dropped: {
    en: "ALERT PU {pu} (Ward {ward}): result DROPPED at ward collation. {n} witnesses posted {ec8a}.",
    pcm: "ALERT PU {pu} (Ward {ward}): dem DROP the result for ward collation. {n} witness post {ec8a}.",
    ha: "GARGADI Rumfa {pu} (Mazaba {ward}): an JEFAR da sakamakon. Shaidu {n} sun aika {ec8a}.",
    yo: "IKILO Ibudo {pu} (Wodu {ward}): a DA esi sile. Elerii {n} fi {ec8a} ranse.",
    ig: "ENYEMAKA Ulo {pu} (Woodu {ward}): wepuru nsonaazu. Ndi akaebe {n} zitere {ec8a}.",
  },
  ussd_contested: {
    en: "PU {pu} (Ward {ward}): witnesses DISAGREE ({n} agree, {d} differ). Majority: {tally}",
    pcm: "PU {pu} (Ward {ward}): witness no agree ({n} agree, {d} no gree). Majority: {tally}",
    ha: "Rumfa {pu} (Mazaba {ward}): shaidu BASU YARDA ba ({n} sun yarda, {d} sun bambanta). {tally}",
    yo: "Ibudo {pu} (Wodu {ward}): elerii KO FOHUN ({n} fohun, {d} yato). {tally}",
    ig: "Ulo {pu} (Woodu {ward}): ndi akaebe AGAGHI EKWEKORITA ({n} kwenyere, {d} ma obu). {tally}",
  },
};

export function t(key: keyof typeof D, lang: Lang, vars: Vars = {}): string {
  const tpl = D[key]?.[lang] ?? D[key]?.en ?? String(key);
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
