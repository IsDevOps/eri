"use client";
import { useState } from "react";
import { PARTIES, fmt } from "@/lib/config";

interface PuPublic {
  code: string;
  ward: string;
  witnesses: number;
  status: string;
  ec8a: Record<string, number> | null;
  readAtWard: Record<string, number> | null;
  message: string;
}
const TONE: Record<string, string> = {
  verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  flagged: "border-red-500/40 bg-red-500/10 text-red-200",
  contested: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  unverified: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  pending: "border-sky-500/30 bg-sky-500/10 text-sky-200",
};

/** Public lookup — the web twin of dialling *347*PU#. */
export function PuCheck() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState<PuPublic | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setRes(null);
    const r = await fetch(`/api/public/pu/${encodeURIComponent(code.trim())}`);
    const j = await r.json();
    if (r.ok) setRes(j);
    else setErr(j.error ?? "Something went wrong.");
    setBusy(false);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#121821] p-5">
      <form onSubmit={go} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
          inputMode="numeric"
          placeholder="Polling-unit code, e.g. 034"
          aria-label="Polling-unit code"
          className="w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-white outline-none focus:border-sky-400"
        />
        <button disabled={busy || !code} className="rounded-lg bg-sky-500 px-5 font-medium text-white hover:bg-sky-400 disabled:opacity-50">
          Check
        </button>
      </form>
      {err && <p role="alert" className="mt-3 text-sm text-red-300">{err}</p>}
      {res && (
        <div className={`eri-in mt-4 rounded-lg border p-4 ${TONE[res.status] ?? TONE.pending}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">
            PU {res.code} · {res.ward} · {res.witnesses} witness{res.witnesses === 1 ? "" : "es"} · {res.status}
          </div>
          <p className="mt-2 text-sm">{res.message}</p>
          {res.ec8a && res.witnesses > 0 && (
            <p className="mt-2 font-mono text-xs opacity-80">
              Witnessed EC8A: {PARTIES.map((p) => `${p} ${fmt(res.ec8a![p] ?? 0)}`).join("  ")}
              {res.readAtWard && <> · Read at ward: {PARTIES.map((p) => `${p} ${fmt(res.readAtWard![p] ?? 0)}`).join("  ")}</>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
