"use client";
import { useState } from "react";
import { usePoll, readJson } from "@/lib/client";

interface PartyRow { key: string; acronym: string; name: string; used: boolean }
interface WardRow { id: number; number: number; name: string; lga: string; pus: { id: number; code: string; name: string; registered: number; submissions: number }[] }

const card = "rounded-xl border border-white/10 bg-[#121821] p-5";
const input = "rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-sky-400";
const btn = "rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400";
const send = (method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

export default function AdminSetup() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
      <Parties />
      <Geography />
    </div>
  );
}

function Parties() {
  const { data: parties, reload } = usePoll<PartyRow[]>("/api/admin/parties", 8000);
  const [f, setF] = useState({ acronym: "", name: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("POST", "/api/admin/parties", f);
    const j = await readJson<{ error?: string; acronym?: string }>(r);
    setMsg(r.ok ? { ok: true, text: `${j?.acronym} added. Witnesses will see it on their form within a minute (or on reload).` } : { ok: false, text: j?.error ?? "Could not add the party." });
    if (r.ok) {
      setF({ acronym: "", name: "" });
      reload();
    }
  }
  async function rename(p: PartyRow) {
    const acronym = prompt(`Acronym for ${p.name}`, p.acronym);
    if (!acronym) return;
    const name = prompt("Full name", p.name);
    if (!name) return;
    const r = await send("PATCH", "/api/admin/parties", { key: p.key, acronym, name });
    const j = await readJson<{ error?: string }>(r);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: j?.error ?? "Could not save." });
    reload();
  }
  async function remove(p: PartyRow) {
    if (!confirm(`Remove ${p.acronym} from the result sheet?`)) return;
    const r = await send("DELETE", `/api/admin/parties?key=${p.key}`);
    const j = await readJson<{ error?: string }>(r);
    setMsg(r.ok ? { ok: true, text: `${p.acronym} removed.` } : { ok: false, text: j?.error ?? "Could not remove." });
    reload();
  }

  return (
    <section className={`${card} space-y-3`}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Parties on the result sheet</h2>
        <p className="mt-1 text-xs text-slate-500">Every figure form, SMS format, sheet reader and Live Ear announcement follows this list. A party that already has recorded figures can be renamed but not removed.</p>
      </div>
      <ul className="divide-y divide-white/5 text-sm">
        {parties?.map((p) => (
          <li key={p.key} className="flex items-center gap-3 py-2">
            <span className="w-14 shrink-0 font-mono font-medium text-white">{p.acronym}</span>
            <span className="min-w-0 flex-1 truncate text-slate-400">{p.name}</span>
            <span className="hidden font-mono text-[11px] text-slate-600 sm:inline" title="Short SMS key">SMS {p.key}</span>
            <button onClick={() => rename(p)} className="text-xs text-slate-400 hover:text-white">Edit</button>
            <button onClick={() => remove(p)} disabled={p.used} title={p.used ? "Has recorded figures" : ""} className="text-xs text-slate-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-slate-400">Remove</button>
          </li>
        ))}
        {!parties && <li className="py-2 text-slate-500">Loading…</li>}
      </ul>
      <form onSubmit={add} className="grid grid-cols-1 gap-2 border-t border-white/10 pt-3 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
        <input className={input} placeholder="Acronym" maxLength={6} value={f.acronym} onChange={(e) => setF({ ...f, acronym: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} required aria-label="Party acronym" />
        <input className={input} placeholder="Full party name" maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required aria-label="Party full name" />
        <button className={btn}>Add party</button>
      </form>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
    </section>
  );
}

function Geography() {
  const { data: wards, reload } = usePoll<WardRow[]>("/api/admin/geo", 8000);
  const [ward, setWard] = useState({ name: "" });
  const [pu, setPu] = useState({ wardId: "", name: "", code: "", registered: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  async function addWard(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("POST", "/api/admin/geo", { kind: "ward", ...ward });
    const j = await readJson<{ error?: string; number?: number }>(r);
    setMsg(r.ok ? { ok: true, text: `Ward ${String(j?.number).padStart(2, "0")} added. Now add its polling units.` } : { ok: false, text: j?.error ?? "Could not add the ward." });
    if (r.ok) {
      setWard({ name: "" });
      reload();
    }
  }
  async function addPu(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("POST", "/api/admin/geo", { kind: "pu", ...pu });
    const j = await readJson<{ error?: string; code?: string; ward?: number }>(r);
    setMsg(r.ok ? { ok: true, text: `PU ${j?.code} added to Ward ${String(j?.ward).padStart(2, "0")}. Witnesses can submit for it now.` } : { ok: false, text: j?.error ?? "Could not add the polling unit." });
    if (r.ok) {
      setPu({ ...pu, name: "", code: "", registered: "" });
      reload();
    }
  }
  async function remove(kind: "pu" | "ward", id: string) {
    if (!confirm(kind === "pu" ? `Remove PU ${id}?` : `Remove Ward ${id}?`)) return;
    const r = await send("DELETE", `/api/admin/geo?${kind}=${encodeURIComponent(id)}`);
    const j = await readJson<{ error?: string }>(r);
    setMsg(r.ok ? { ok: true, text: "Removed." } : { ok: false, text: j?.error ?? "Could not remove." });
    reload();
  }

  const total = wards?.reduce((n, w) => n + w.pus.length, 0) ?? 0;
  return (
    <section className={`${card} space-y-3`}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Wards & polling units</h2>
        <p className="mt-1 text-xs text-slate-500">{wards ? `${wards.length} wards · ${total} polling units.` : "Loading…"} New polling units start as “Awaiting” until a witness submits. Units or wards with recorded activity can’t be removed.</p>
      </div>
      <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
        {wards?.map((w) => (
          <li key={w.id} className="rounded-lg border border-white/5">
            <div className="flex items-center gap-2 px-3 py-1.5">
              <button onClick={() => setOpen(open === w.id ? null : w.id)} aria-expanded={open === w.id} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="text-xs text-slate-500">{open === w.id ? "▾" : "▸"}</span>
                <span className="truncate font-medium text-white">Ward {String(w.number).padStart(2, "0")} · {w.name}</span>
                <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{w.pus.length} PUs</span>
              </button>
              {!w.pus.length && <button onClick={() => remove("ward", String(w.number))} className="text-xs text-slate-400 hover:text-red-300">Remove</button>}
            </div>
            {open === w.id && (
              <ul className="space-y-0.5 border-t border-white/5 px-3 py-2 text-xs">
                {w.pus.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 font-mono text-slate-300">{p.code}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{p.name}</span>
                    <span className="shrink-0 text-slate-600">{p.registered} reg.</span>
                    {p.submissions === 0 && <button onClick={() => remove("pu", p.code)} className="text-slate-500 hover:text-red-300">Remove</button>}
                  </li>
                ))}
                {!w.pus.length && <li className="text-slate-500">No polling units yet.</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={addPu} className="space-y-2 border-t border-white/10 pt-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-slate-400">Add a polling unit</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className={`${input} sm:col-span-2`} value={pu.wardId} onChange={(e) => setPu({ ...pu, wardId: e.target.value })} required aria-label="Ward">
            <option value="">Choose a ward…</option>
            {wards?.map((w) => <option key={w.id} value={w.id}>Ward {String(w.number).padStart(2, "0")} · {w.name}</option>)}
          </select>
          <input className={`${input} sm:col-span-2`} placeholder="Polling unit name, e.g. Primary School Gate" value={pu.name} onChange={(e) => setPu({ ...pu, name: e.target.value })} required aria-label="Polling unit name" />
          <input className={input} inputMode="numeric" maxLength={3} placeholder="Code (blank = next free)" value={pu.code} onChange={(e) => setPu({ ...pu, code: e.target.value.replace(/\D/g, "") })} aria-label="Polling unit code" />
          <input className={input} inputMode="numeric" placeholder="Registered voters (default 500)" value={pu.registered} onChange={(e) => setPu({ ...pu, registered: e.target.value.replace(/\D/g, "") })} aria-label="Registered voters" />
        </div>
        <button className={btn}>Add polling unit</button>
      </form>

      <form onSubmit={addWard} className="flex gap-2 border-t border-white/10 pt-3">
        <input className={`${input} min-w-0 flex-1`} placeholder="New ward name" value={ward.name} onChange={(e) => setWard({ name: e.target.value })} required aria-label="Ward name" />
        <button className={btn}>Add ward</button>
      </form>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
    </section>
  );
}
