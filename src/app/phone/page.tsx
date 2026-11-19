"use client";
import { useEffect, useRef, useState } from "react";
import { LANGS, LANG_NAMES, USSD_CODE, SHORTCODE, partyName, tallyText } from "@/lib/config";
import { usePoll } from "@/lib/client";
import { witVerb } from "@/lib/plural";

const AGENT = "+2348090000001";
const AMAKA = "+2348031230034";
const TUNDE = "+2348000003402"; // Yoruba witness who also gets a voice call

interface Msg {
  id: number;
  channel?: string;
  body: string;
  lang: string;
  created_at: string;
}
interface Sheet {
  pu: string;
  file: string;
  note: string;
}

function PhoneShell({ title, subtitle, children, tone = "slate", buzz = false }: { title: string; subtitle: string; children: React.ReactNode; tone?: "slate" | "green"; buzz?: boolean }) {
  return (
    <div className={`mx-auto w-full max-w-[340px] ${buzz ? "eri-buzz" : ""}`}>
      <div className="rounded-[2rem] border-4 border-slate-700 bg-slate-900 p-3 shadow-2xl">
        <div className={`mb-2 rounded-xl px-3 py-2 text-center ${tone === "green" ? "bg-emerald-700" : "bg-slate-800"}`}>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="text-[11px] text-slate-300">{subtitle}</div>
        </div>
        <div className="flex h-[480px] flex-col overflow-hidden rounded-xl bg-[#0e1318]">{children}</div>
      </div>
    </div>
  );
}

const SPEECH_LANG: Record<string, string> = { en: "en-NG", pcm: "en-NG", ha: "ha", yo: "yo", ig: "ig" };
function speak(m: Msg) {
  try {
    const u = new SpeechSynthesisUtterance(m.body.replace(/^Eri: /, ""));
    u.lang = SPEECH_LANG[m.lang] ?? "en";
    speechSynthesis.speak(u);
  } catch {}
}

function Bubbles({ msgs }: { msgs: Msg[] }) {
  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {[...msgs].reverse().map((m) => (
        <div key={m.id} className="eri-in max-w-[92%] rounded-2xl rounded-tl-sm bg-slate-700/70 px-3 py-2 text-[13px] leading-snug text-slate-100">
          {m.channel === "voice" && (
            <button onClick={() => speak(m)} className="mb-1 flex items-center gap-1.5 rounded bg-emerald-700 px-2 py-1 text-[11px] font-medium text-white">
              📞 Incoming call — tap to answer
            </button>
          )}
          {m.channel === "voice" ? <span className="text-[11px] text-slate-400">(spoken in {m.lang.toUpperCase()})</span> : m.body}
          <div className="mt-1 text-[10px] uppercase text-slate-400">{m.channel === "voice" ? "voice" : m.lang}</div>
        </div>
      ))}
      {!msgs.length && <p className="pt-10 text-center text-xs text-slate-500">No messages yet</p>}
    </div>
  );
}

export default function Phones() {
  /* ---------- polling agent: SMS ---------- */
  const { data: agentMsgs, reload: reloadAgent } = usePoll<Msg[]>(`/api/outbox?phone=${encodeURIComponent(AGENT)}`, 1500);
  const [pu, setPu] = useState("017");
  const [fig, setFig] = useState({ A: "", B: "", C: "", D: "" });
  const [smsText, setSmsText] = useState("");
  const [sending, setSending] = useState(false);

  const encode = async () => {
    const qs = new URLSearchParams({ pu, ...fig });
    const j = await (await fetch(`/api/encode?${qs}`)).json();
    setSmsText(j.sms);
  };
  const sendSms = async (text = smsText) => {
    if (!text) return;
    setSending(true);
    await fetch("/api/sms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: AGENT, text }) });
    setSending(false);
    reloadAgent();
  };

  /* ---------- Amaka: feature phone ---------- */
  const [who, setWho] = useState(AMAKA);
  const { data: amakaMsgs } = usePoll<Msg[]>(`/api/outbox?phone=${encodeURIComponent(who)}`, 1000);
  const lastAmaka = useRef<number>(0);
  const [buzz, setBuzz] = useState(false);
  useEffect(() => {
    const top = amakaMsgs?.[0]?.id ?? 0;
    if (lastAmaka.current && top > lastAmaka.current) {
      setBuzz(true);
      setTimeout(() => setBuzz(false), 2600);
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
    }
    if (amakaMsgs) lastAmaka.current = top;
  }, [amakaMsgs]);
  const [dial, setDial] = useState("*347*034#");
  const [ussd, setUssd] = useState<{ text: string; open: boolean; input: string } | null>(null);
  const [ussdPath, setUssdPath] = useState("");

  const runUssd = async (path: string) => {
    const r = await fetch("/api/ussd", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phoneNumber: who, text: path }) });
    const raw = await r.text();
    setUssd({ text: raw.replace(/^(CON|END) /, ""), open: raw.startsWith("CON"), input: "" });
  };
  const startDial = () => {
    // *347*034# -> text "034" ; *347# -> "" (menu)
    const m = dial.match(/^\*\d+(?:\*([\d*]+))?#$/);
    const path = m?.[1] ?? "";
    setUssdPath(path);
    runUssd(path);
  };

  /* ---------- WhatsApp bot ---------- */
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [chat, setChat] = useState<{ from: "me" | "bot"; text?: string; img?: string; tone?: string }[]>([]);
  const [wa, setWa] = useState(false);
  useEffect(() => {
    fetch("/assets/ec8a/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, Sheet>) => setSheets(Object.values(m)))
      .catch(() => {});
  }, []);

  const sendImage = async (blob: Blob, name: string, url: string, mode: "submit" | "check") => {
    setWa(true);
    setChat((c) => [...c, { from: "me", img: url, text: mode === "check" ? "Forwarded: is this real?" : "My result" }]);
    const fd = new FormData();
    fd.set("file", new File([blob], name, { type: blob.type || "image/png" }));
    if (mode === "submit") {
      fd.set("phone", AGENT);
      fd.set("source", "whatsapp");
    }
    const r = await fetch(mode === "submit" ? "/api/photo" : "/api/check-image", { method: "POST", body: fd });
    const j = await r.json();
    let text: string;
    let tone = "";
    if (mode === "submit") {
      if (j.ok) {
        const t = j.reading.tally;
        text = `✅ Read PU ${j.reading.puCode}: ${tallyText(t)} (${Math.round(j.reading.confidence * 100)}% sure). ${witVerb(j.agree)}. No typing needed.`;
      } else text = `⚠️ ${j.error}`;
    } else {
      text = (j.verdict === "genuine" ? "✅ " : j.verdict === "fake" ? "🚩 " : "ℹ️ ") + (j.message ?? j.error);
      tone = j.verdict;
    }
    setChat((c) => [...c, { from: "bot", text, tone }]);
    setWa(false);
  };
  const sendSheet = async (s: Sheet, mode: "submit" | "check") => {
    const url = `/assets/ec8a/${s.file}`;
    sendImage(await (await fetch(url)).blob(), s.file, url, mode);
  };

  const reset = async () => {
    if (!confirm("Clear live activity (collation, alerts, SMS, submissions)?")) return;
    await fetch("/api/admin/reset", { method: "POST" });
    setChat([]);
    setUssd(null);
    reloadAgent();
  };

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest text-sky-300">Field channels</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Works on any phone, any network</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Field channels: SMS to shortcode {SHORTCODE} over 2G, a USSD check, and a WhatsApp bot that
            reads handwriting. Real gateways (Africa&apos;s Talking) plug into <code>/api/sms</code> and <code>/api/ussd</code> unchanged.
          </p>
        </div>
        <button onClick={reset} className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:bg-white/10">
          ↺ Clear live activity
        </button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* ---------------- Polling agent SMS ---------------- */}
        <PhoneShell title="Polling agent · SMS" subtitle={`${AGENT} → ${SHORTCODE}`}>
          <Bubbles msgs={agentMsgs ?? []} />
          <div className="space-y-2 border-t border-white/10 p-2">
            <div className="grid grid-cols-5 gap-1.5">
              <input value={pu} onChange={(e) => setPu(e.target.value)} placeholder="PU" className="col-span-1 rounded bg-white/10 px-2 py-1 text-xs text-white outline-none" />
              {(["A", "B", "C", "D"] as const).map((p) => (
                <input key={p} value={fig[p]} onChange={(e) => setFig({ ...fig, [p]: e.target.value })} placeholder={partyName(p)} className="rounded bg-white/10 px-2 py-1 text-xs text-white outline-none" />
              ))}
            </div>
            <div className="flex gap-1.5">
              <button onClick={encode} className="rounded bg-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/15">Build SMS</button>
              <button onClick={() => setSmsText((s) => s.replace(/#[0-9A-F]{3}$/, "#000"))} className="rounded bg-white/10 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/15">Garble</button>
              <select
                onChange={(e) => e.target.value && sendSms(`LANG ${e.target.value.toUpperCase()}`)}
                defaultValue=""
                className="ml-auto rounded bg-white/10 px-1 py-1 text-[11px] text-slate-200"
              >
                <option value="">Language…</option>
                {LANGS.map((l) => (
                  <option key={l} value={l}>{LANG_NAMES[l]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5">
              <input
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                placeholder="R 012 A120 B85 C40 #7F3"
                className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1.5 font-mono text-xs text-white outline-none"
              />
              <button disabled={sending || !smsText} onClick={() => sendSms()} className="rounded bg-sky-500 px-3 text-sm font-medium text-white disabled:opacity-40">Send</button>
            </div>
          </div>
        </PhoneShell>

        {/* ---------------- Amaka's basic phone ---------------- */}
        <PhoneShell title={who === AMAKA ? "Amaka · basic phone" : "Tunde · basic phone"} subtitle={`${who} · ${who === AMAKA ? "Igbo · SMS" : "Yoruba · SMS + voice"} · PU 034`} tone="green" buzz={buzz}>
          {ussd ? (
            <div className="flex flex-1 flex-col justify-between bg-[#1b2b1f] p-3 font-mono text-[13px] leading-snug text-emerald-100">
              <div className="whitespace-pre-wrap">{ussd.text}</div>
              <div className="space-y-2">
                {ussd.open && (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      value={ussd.input}
                      onChange={(e) => setUssd({ ...ussd, input: e.target.value })}
                      className="min-w-0 flex-1 rounded bg-black/40 px-2 py-1 text-emerald-100 outline-none"
                    />
                    <button
                      onClick={() => {
                        const p = ussdPath ? `${ussdPath}*${ussd.input}` : ussd.input;
                        setUssdPath(p);
                        runUssd(p);
                      }}
                      className="rounded bg-emerald-600 px-3 text-white"
                    >
                      Send
                    </button>
                  </div>
                )}
                <button onClick={() => setUssd(null)} className="w-full rounded bg-black/40 py-1.5 text-xs text-emerald-200">
                  {ussd.open ? "Cancel" : "OK"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <Bubbles msgs={amakaMsgs ?? []} />
              <div className="space-y-2 border-t border-white/10 p-2">
                <select value={who} onChange={(e) => setWho(e.target.value)} className="w-full rounded bg-white/10 px-2 py-1 text-[11px] text-slate-200">
                  <option value={AMAKA}>Amaka — Igbo, SMS</option>
                  <option value={TUNDE}>Tunde — Yoruba, SMS + voice call</option>
                </select>
                <div className="text-[11px] text-slate-500">Dial the check code ({USSD_CODE}) — replace PU with your code</div>
                <div className="flex gap-1.5">
                  <input value={dial} onChange={(e) => setDial(e.target.value)} className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1.5 font-mono text-sm text-white outline-none" />
                  <button onClick={startDial} className="rounded bg-emerald-600 px-3 text-sm font-medium text-white">Call</button>
                </div>
              </div>
            </>
          )}
        </PhoneShell>

        {/* ---------------- WhatsApp bot ---------------- */}
        <PhoneShell title="Ẹ̀rí on WhatsApp" subtitle="AI reads the handwriting" tone="green">
          <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b141a] p-3">
            {!chat.length && <p className="pt-6 text-center text-xs text-slate-500">Send a polling-unit photo, or forward a viral “result sheet” to check it.</p>}
            {chat.map((c, i) => (
              <div key={i} className={`eri-in max-w-[88%] rounded-lg px-2.5 py-2 text-[13px] ${c.from === "me" ? "ml-auto bg-emerald-800 text-white" : c.tone === "fake" ? "bg-red-900/70 text-red-100" : "bg-slate-700/80 text-slate-100"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.img && <img src={c.img} alt="sheet" className="mb-1 w-40 rounded" />}
                {c.text}
              </div>
            ))}
            {wa && <div className="text-xs text-slate-500">Ẹ̀rí is reading…</div>}
          </div>
          <div className="max-h-44 space-y-1.5 overflow-y-auto border-t border-white/10 p-2">
            {sheets.map((s) => (
              <div key={s.file} className="flex items-center gap-2 rounded bg-white/5 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/ec8a/${s.file}`} alt="" className="h-9 w-8 rounded object-cover" />
                <div className="min-w-0 flex-1 text-[11px] leading-tight text-slate-300">
                  <div className="font-mono">{s.file}</div>
                </div>
                <button onClick={() => sendSheet(s, "submit")} className="rounded bg-emerald-700 px-1.5 py-1 text-[10px] text-white">Submit</button>
                <button onClick={() => sendSheet(s, "check")} className="rounded bg-amber-700 px-1.5 py-1 text-[10px] text-white">Check</button>
              </div>
            ))}
            <label className="block cursor-pointer rounded bg-white/10 py-1.5 text-center text-[11px] text-slate-200 hover:bg-white/15">
              Upload your own image to check
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) sendImage(f, f.name, URL.createObjectURL(f), "check");
                }}
              />
            </label>
          </div>
        </PhoneShell>
      </div>
    </main>
  );
}
