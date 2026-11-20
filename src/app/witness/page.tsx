"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import { Pill } from "@/components/TreeView";
import { readJson, usePoll } from "@/lib/client";
import { LANGS, LANG_NAMES, PARTIES, fmt, partyName, type Lang } from "@/lib/config";
import { witVerb } from "@/lib/plural";
import type { Status } from "@/lib/reconcile";

/** How a result reached us, in words a witness uses. */
const SOURCE_LABEL: Record<string, string> = { sms: "text or typed entry", photo: "photo", whatsapp: "WhatsApp photo" };

interface Me {
  user: { name: string; email: string; phone: string | null; phoneVerified: boolean };
  prefs: { lang: Lang; voice: boolean } | null;
  submissions: { code: string; ward: number; source: string; results: Record<string, number>; created_at: string; status: Status; reason: string; witnesses: number }[];
  messages: { id: number; channel: string; lang: string; body: string; created_at: string }[];
}

const card = "rounded-xl border border-white/10 bg-[#121821] p-5";
const input = "w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-sky-400";
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export default function WitnessPortal() {
  const { data: me, reload } = usePoll<Me>("/api/me", 4000);
  if (!me) return <main className="mx-auto max-w-5xl px-5 py-10 text-slate-500">Loading…</main>;
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-2xl font-semibold text-white">Hello, {me.user.name}</h1>
        <p className="text-sm text-slate-400">
          Your witness account · {me.user.phone} {me.user.phoneVerified ? <span className="text-emerald-300">· verified</span> : <span className="text-amber-300">· not verified</span>}
        </p>
      </header>
      {!me.user.phoneVerified ? <Verify onDone={reload} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Submit onDone={reload} />
            <MyPollingUnits subs={me.submissions} />
          </div>
          <div className="space-y-6">
            <Prefs prefs={me.prefs!} onDone={reload} />
            <Alerts msgs={me.messages} />
          </div>
        </div>
      )}
    </main>
  );
}

function Verify({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  // verification code stashed by the register form while SMS delivery is simulated; server render sees null, the browser sees the stored value
  const stored = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem("eri_devcode"),
    () => null,
  );
  const [resent, setResent] = useState<string | null>(null);
  const hint = resent ?? stored;
  async function check(e: React.FormEvent) {
    e.preventDefault();
    const r = await post("/api/auth/verify-phone", { code });
    const j = await r.json();
    if (j.ok) onDone();
    else setErr(j.error);
  }
  async function resend() {
    const r = await post("/api/auth/resend-code", {});
    const j = await r.json();
    if (!r.ok) setErr(j.error);
    else {
      setErr("");
      if (j.devCode) setResent(j.devCode);
    }
  }
  return (
    <form onSubmit={check} className={`${card} max-w-md space-y-3`}>
      <h2 className="text-lg font-medium text-white">Confirm your phone</h2>
      <p className="text-sm text-slate-400">We sent a 6-digit code by SMS. Until you confirm it you can’t submit results or see alerts — that stops anyone reading messages meant for someone else.</p>
      {hint && <p className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Your verification code: <span className="font-mono text-base">{hint}</span></p>}
      <input className={input} inputMode="numeric" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Verification code" />
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <div className="flex gap-2">
        <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">Verify</button>
        <button type="button" onClick={resend} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Send a new code</button>
      </div>
    </form>
  );
}

/** Every party field and the PU code are filled in. */
const e0 = (pu: string, vals: Record<string, string>) => pu.length > 0 && PARTIES.every((p) => (vals[p] ?? "") !== "");

function Submit({ onDone }: { onDone: () => void }) {
  const [pu, setPu] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string; status?: Status; practice?: boolean } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function send(practice: boolean) {
    const r = await post("/api/witness/submit", { pu, ...vals, practice });
    const j = await readJson<{ ok?: boolean; pu?: string; agree?: number; reason?: string; status?: Status; others?: number }>(r);
    if (!j.ok) return setMsg({ ok: false, text: j.error ?? "Could not submit." });
    const base = practice
      ? `Practice only — nothing was recorded or sent. If you submitted these figures for PU ${j.pu}: ${j.reason}`
      : `Recorded for PU ${j.pu}. ${j.reason || `${witVerb(j.agree ?? 1)}.`}`;
    setMsg({ ok: true, text: base, status: j.status, practice });
    if (!practice) onDone();
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    return send(false);
  };
  async function photo(f: File) {
    const fd = new FormData();
    fd.set("file", f);
    fd.set("source", "photo");
    setMsg({ ok: true, text: "Reading the sheet…" });
    const j = await (await fetch("/api/photo", { method: "POST", body: fd })).json();
    setMsg(j.ok ? { ok: true, text: `Read PU ${j.reading?.puCode ?? ""} from your photo (${Math.round((j.reading?.confidence ?? 0) * 100)}% confident) and recorded it.` } : { ok: false, text: j.error ?? "Could not read that photo." });
    if (j.ok) onDone();
    if (file.current) file.current.value = "";
  }

  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Submit your polling unit’s result (EC8A)</h2>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-2" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${PARTIES.length}, minmax(0,1fr))` }}>
          <label className="text-xs text-slate-400">
            PU code
            <input className={`${input} mt-1`} inputMode="numeric" maxLength={3} value={pu} onChange={(e) => setPu(e.target.value.replace(/\D/g, ""))} required />
          </label>
          {PARTIES.map((p) => (
            <label key={p} className="text-xs text-slate-400">
              {partyName(p)}
              <input className={`${input} mt-1`} inputMode="numeric" value={vals[p] ?? ""} onChange={(e) => setVals({ ...vals, [p]: e.target.value.replace(/\D/g, "") })} required />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">Submit figures</button>
          <button
            type="button"
            onClick={() => (e0(pu, vals) ? send(true) : setMsg({ ok: false, text: "Fill in the polling-unit code and every party's figure to try it." }))}
            className="rounded-lg border border-sky-400/40 px-4 py-2 text-sm text-sky-200 hover:bg-sky-400/10"
          >
            Try without recording
          </button>
          <span className="text-xs text-slate-500">or</span>
          <label className="cursor-pointer rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            Upload a photo of the sheet
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && photo(e.target.files[0])} />
          </label>
        </div>
      </form>
      <p className="mt-3 text-xs text-slate-500">
        Type exactly what the signed EC8A sheet at your polling unit says — Ẹ̀rí never shows you the other witnesses’ numbers. “Contested” means witnesses at the same unit submitted different figures; “Flagged” means your figures differ from what was read out at ward collation. “Try without recording” shows which of these you would get, and records nothing.
      </p>
      {msg && (
        <div role="status" className={`mt-3 rounded-lg border p-3 text-sm ${msg.practice ? "border-sky-400/30 bg-sky-400/5" : "border-transparent"} ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>
          {msg.status && <div className="mb-1"><Pill status={msg.status} /></div>}
          {msg.text}
        </div>
      )}
    </section>
  );
}

function MyPollingUnits({ subs }: { subs: Me["submissions"] }) {
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">My polling units</h2>
      {!subs.length && <p className="text-sm text-slate-500">You haven’t submitted a result yet.</p>}
      <ul className="space-y-3">
        {subs.map((s) => (
          <li key={s.code} className="rounded-lg border border-white/10 bg-[#0f141b] p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white">PU {s.code} <span className="text-xs text-slate-500">· Ward {String(s.ward).padStart(2, "0")} · via {SOURCE_LABEL[s.source] ?? s.source}</span></span>
              <Pill status={s.status} />
            </div>
            <p className="mt-1 font-mono text-xs text-slate-400">{PARTIES.map((p) => `${partyName(p)} ${fmt(s.results[p] ?? 0)}`).join("  ")}</p>
            <p className="mt-1 text-sm text-slate-300">{s.reason}</p>
            {s.status === "contested" && (
              <p className="mt-1 text-xs text-amber-300">Observers see the figures most witnesses at this unit agree on, not only yours. If you copied your sheet exactly, your figures stay on record above as your own entry.</p>
            )}
            {s.status === "flagged" && (
              <p className="mt-1 text-xs text-red-300">Your figures differ from what was read out at ward collation. Observers see both, and your entry is kept as evidence.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Prefs({ prefs, onDone }: { prefs: NonNullable<Me["prefs"]>; onDone: () => void }) {
  const patch = async (b: object) => {
    await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    onDone();
  };
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">My alerts</h2>
      <label className="block text-xs text-slate-400">
        Language
        <select className={`${input} mt-1`} value={prefs.lang} onChange={(e) => patch({ lang: e.target.value })}>
          {LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
        </select>
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={prefs.voice} onChange={(e) => patch({ voice: e.target.checked })} /> Also call me with a spoken alert
      </label>
    </section>
  );
}

function Alerts({ msgs }: { msgs: Me["messages"] }) {
  return (
    <section className={card}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Messages sent to me</h2>
      {!msgs.length && <p className="text-sm text-slate-500">All quiet. If your polling unit’s result changes after it leaves the polling unit, you’ll be told here and by SMS.</p>}
      <ul className="space-y-2">
        {msgs.map((m) => (
          <li key={m.id} className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-slate-200">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-red-300">{m.channel} · {new Date(m.created_at).toLocaleString()}</div>
            {m.body}
          </li>
        ))}
      </ul>
    </section>
  );
}
