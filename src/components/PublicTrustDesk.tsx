"use client";

import { useRef, useState } from "react";
import { PARTIES, fmt } from "@/lib/config";

type DeskMode = "lookup" | "verify" | "report";

interface PuPublic {
  code: string;
  ward: string;
  witnesses: number;
  status: "verified" | "flagged" | "contested" | "unverified" | "pending";
  wall: Record<string, number> | null;
  readAtWard: Record<string, number> | null;
  message: string;
}

interface ImageVerdict {
  verdict: "genuine" | "fake" | "unknown" | "unreadable" | "error";
  pu?: string;
  message?: string;
}

const statusCopy: Record<PuPublic["status"], { label: string; tone: string; detail: string }> = {
  verified: { label: "Matches at this hop", tone: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100", detail: "The figures posted by witnesses match what was read at ward collation." },
  flagged: { label: "A change was detected", tone: "border-rose-400/40 bg-rose-400/10 text-rose-100", detail: "The wall evidence and the announced figures do not match. Witnesses have been alerted." },
  contested: { label: "Witnesses disagree", tone: "border-amber-300/40 bg-amber-300/10 text-amber-100", detail: "This needs more independent evidence before it can be treated as settled." },
  unverified: { label: "Evidence is still incomplete", tone: "border-amber-300/40 bg-amber-300/10 text-amber-100", detail: "Some evidence exists, but it cannot yet prove the full result trail." },
  pending: { label: "Waiting for collation", tone: "border-sky-300/35 bg-sky-300/10 text-sky-100", detail: "The wall has been recorded; the next official announcement has not arrived." },
};

const incidentTypes = [
  ["violence", "Violence or intimidation"],
  ["vote_buying", "Vote buying or coercion"],
  ["delay", "Materials or officials delayed"],
  ["access", "Access barrier or exclusion"],
  ["other", "Other election concern"],
] as const;

function TabIcon({ n }: { n: string }) {
  return <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-md bg-white/10 font-mono text-[10px] font-semibold text-sky-200">{n}</span>;
}

/** Public, low-data election-day actions. Kept client-side so every action can respond without a page reload. */
export function PublicTrustDesk() {
  const [mode, setMode] = useState<DeskMode>("lookup");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<PuPublic | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [imageResult, setImageResult] = useState<ImageVerdict | null>(null);
  const [checkingImage, setCheckingImage] = useState(false);
  const [report, setReport] = useState({ category: "violence", details: "" });
  const [reportState, setReportState] = useState<{ ok: boolean; text: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const cleanCode = (value: string) => value.replace(/\D/g, "").slice(0, 3);

  async function lookup(e?: React.FormEvent, requestedCode?: string) {
    e?.preventDefault();
    const codeToCheck = requestedCode ?? code;
    if (!codeToCheck) return;
    setLookingUp(true);
    setLookupError("");
    setResult(null);
    try {
      const response = await fetch(`/api/public/pu/${encodeURIComponent(codeToCheck.padStart(3, "0"))}`);
      const body = await response.json();
      if (!response.ok) setLookupError(body.error ?? "We could not check this polling unit right now.");
      else setResult(body);
    } catch {
      setLookupError("Your connection dropped. Please try again when you have signal.");
    } finally {
      setLookingUp(false);
    }
  }

  async function verifyImage(e: React.FormEvent) {
    e.preventDefault();
    if (!image) return;
    setCheckingImage(true);
    setImageResult(null);
    const body = new FormData();
    body.set("file", image);
    try {
      const response = await fetch("/api/check-image", { method: "POST", body });
      const verdict = (await response.json()) as ImageVerdict;
      setImageResult(response.ok ? verdict : { verdict: "error", message: verdict.message ?? "We could not check that image." });
    } catch {
      setImageResult({ verdict: "error", message: "Your connection dropped. The image was not checked." });
    } finally {
      setCheckingImage(false);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    setReporting(true);
    setReportState(null);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pu: code.padStart(3, "0"), ...report }),
      });
      const body = await response.json();
      if (response.ok) {
        setReportState({ ok: true, text: "Report received. It is marked unverified and routed for review—not published as fact." });
        setReport((current) => ({ ...current, details: "" }));
      } else setReportState({ ok: false, text: body.error ?? "We could not send that report." });
    } catch {
      setReportState({ ok: false, text: "Your connection dropped. The report was not sent." });
    } finally {
      setReporting(false);
    }
  }

  return (
    <section aria-label="Election day trust desk" className="overflow-hidden rounded-3xl border border-white/10 bg-[#121a25] shadow-2xl shadow-sky-950/20">
      <div className="border-b border-white/10 bg-linear-to-r from-sky-500/15 via-transparent to-emerald-400/10 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Election-day trust desk</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Check evidence. Stop rumours. Raise concerns safely.</h2>
          </div>
          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-100">Low-data friendly</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Every result carries its evidence status. An unverified report never becomes a public fact just because it is submitted.</p>
      </div>

      <div className="grid border-b border-white/10 sm:grid-cols-3">
        {([
          ["lookup", "01", "Trace a result", "Check the polling-unit wall against the next hop."],
          ["verify", "02", "Check an image", "Test a forwarded result sheet against witness evidence."],
          ["report", "03", "Raise a concern", "Send a structured, private report for triage."],
        ] as const).map(([value, n, title, detail]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`group flex min-h-24 gap-3 border-b border-white/10 p-4 text-left transition last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${mode === value ? "bg-white/[0.07]" : "hover:bg-white/[0.035]"}`}
            aria-pressed={mode === value}
          >
            <TabIcon n={n} />
            <span>
              <span className={`block text-sm font-semibold ${mode === value ? "text-white" : "text-slate-300"}`}>{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{detail}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {mode === "lookup" && (
          <div className="eri-in">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Trace a polling-unit result</h3>
                <p className="mt-1 text-sm text-slate-400">Use the three-digit code on the EC8A result sheet. No account or phone number is needed.</p>
              </div>
              <button type="button" onClick={() => { setCode("034"); void lookup(undefined, "034"); }} className="rounded-lg border border-sky-300/25 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-400/10">Try the live demo: 034</button>
            </div>
            <form onSubmit={lookup} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="pu-code">Polling-unit code</label>
              <input
                id="pu-code"
                value={code}
                onChange={(event) => setCode(cleanCode(event.target.value))}
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 034"
                className="min-h-12 flex-1 rounded-xl border border-white/10 bg-[#0a1018] px-4 font-mono text-base tracking-[0.2em] text-white outline-none placeholder:tracking-normal placeholder:text-slate-600 focus:border-sky-300 focus:ring-4 focus:ring-sky-400/10"
              />
              <button disabled={lookingUp || !code} className="min-h-12 rounded-xl bg-sky-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-45">
                {lookingUp ? "Checking evidence…" : "Trace this result"}
              </button>
            </form>
            {lookupError && <p role="alert" className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{lookupError}</p>}
            {result && <ResultTrail result={result} onVerify={() => setMode("verify")} onReport={() => setMode("report")} />}
          </div>
        )}

        {mode === "verify" && (
          <form onSubmit={verifyImage} className="eri-in max-w-2xl">
            <h3 className="font-semibold text-white">Check a forwarded result sheet</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">Upload an EC8A image. We compare its figures with independent witness submissions; the image is checked but not saved by this tool.</p>
            <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/2.5 p-4 transition hover:border-sky-300/50 hover:bg-sky-400/[0.04]">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-400/10 text-sm font-semibold text-sky-200">IMG</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-200">{image?.name ?? "Choose a result-sheet image"}</span>
                <span className="mt-0.5 block text-xs text-slate-500">JPG, PNG or WebP · up to 8 MB</span>
              </span>
              <span className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200">Browse</span>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </label>
            <button disabled={!image || checkingImage} className="mt-3 min-h-11 rounded-xl bg-sky-400 px-4 text-sm font-semibold text-slate-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-45">{checkingImage ? "Checking against evidence…" : "Check this image"}</button>
            {imageResult && <ImageCheck result={imageResult} />}
          </form>
        )}

        {mode === "report" && (
          <form onSubmit={submitReport} className="eri-in max-w-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Raise an election-day concern</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">Send only what you saw. Avoid names, faces, or details that could put someone at risk.</p>
              </div>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">Private triage · unverified</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[150px_1fr]">
              <label className="text-sm text-slate-300">Polling-unit code
                <input value={code} onChange={(event) => setCode(cleanCode(event.target.value))} inputMode="numeric" maxLength={3} placeholder="e.g. 034" className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#0a1018] px-3 font-mono text-white outline-none focus:border-sky-300" required />
              </label>
              <label className="text-sm text-slate-300">What happened?
                <select value={report.category} onChange={(event) => setReport({ ...report, category: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#0a1018] px-3 text-white outline-none focus:border-sky-300">
                  {incidentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-sm text-slate-300">Short description
              <textarea value={report.details} onChange={(event) => setReport({ ...report, details: event.target.value.slice(0, 500) })} rows={4} minLength={20} maxLength={500} placeholder="Describe what happened, when, and what help is needed. Do not include names or personal details." className="mt-1 w-full rounded-lg border border-white/10 bg-[#0a1018] p-3 text-sm leading-relaxed text-white outline-none placeholder:text-slate-600 focus:border-sky-300" required />
              <span className="mt-1 block text-right text-xs text-slate-500">{report.details.length}/500</span>
            </label>
            <button disabled={reporting || report.details.trim().length < 20 || !code} className="min-h-11 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45">{reporting ? "Sending safely…" : "Send for review"}</button>
            {reportState && <p role="status" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${reportState.ok ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100" : "border-rose-400/25 bg-rose-400/10 text-rose-100"}`}>{reportState.text}</p>}
          </form>
        )}
      </div>
    </section>
  );
}

function ResultTrail({ result, onVerify, onReport }: { result: PuPublic; onVerify: () => void; onReport: () => void }) {
  const status = statusCopy[result.status];
  const wardState = result.readAtWard ? (result.status === "flagged" ? "Different figures detected" : "Figures read at ward") : "Awaiting ward collation";
  return (
    <article aria-live="polite" className={`eri-in mt-5 overflow-hidden rounded-2xl border ${status.tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-current/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] opacity-70">Polling unit {result.code} · {result.ward}</p>
          <h4 className="mt-1 text-lg font-semibold">{status.label}</h4>
        </div>
        <span className="rounded-full border border-current/20 px-2.5 py-1 text-xs font-medium">{result.witnesses} witness{result.witnesses === 1 ? "" : "es"}</span>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-sm leading-relaxed opacity-85">{status.detail}</p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3">
          <TrailStep n="1" label="Wall evidence" value={result.wall ? `${result.witnesses} witness posts` : "No wall posted yet"} done={!!result.wall} />
          <TrailStep n="2" label="Ward collation" value={wardState} done={!!result.readAtWard} alert={result.status === "flagged"} />
          <TrailStep n="3" label="Next announcement" value="Continues as results move up" />
        </ol>
        {result.wall && <div className="mt-4 rounded-xl bg-black/15 p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] opacity-65"><span>Figures on the wall</span><span>Votes</span></div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm tabular-nums sm:grid-cols-4">
            {PARTIES.map((party) => <span key={party} className="flex justify-between gap-3"><span className="opacity-65">{party}</span><span>{fmt(result.wall?.[party] ?? 0)}</span></span>)}
          </div>
        </div>}
        <p className="mt-3 text-xs leading-relaxed opacity-70">{result.message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onVerify} className="rounded-lg border border-current/25 px-3 py-2 text-xs font-semibold hover:bg-white/10">Check a result image</button>
          <button type="button" onClick={onReport} className="rounded-lg border border-current/25 px-3 py-2 text-xs font-semibold hover:bg-white/10">Report a concern</button>
        </div>
      </div>
    </article>
  );
}

function TrailStep({ n, label, value, done, alert }: { n: string; label: string; value: string; done?: boolean; alert?: boolean }) {
  return <li className="rounded-xl border border-current/10 bg-black/10 p-3"><span className={`mb-2 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${alert ? "bg-rose-300 text-rose-950" : done ? "bg-emerald-300 text-emerald-950" : "bg-white/15"}`}>{alert ? "!" : done ? "✓" : n}</span><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-xs leading-relaxed opacity-70">{value}</span></li>;
}

function ImageCheck({ result }: { result: ImageVerdict }) {
  const style = result.verdict === "genuine" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : result.verdict === "fake" ? "border-rose-400/30 bg-rose-400/10 text-rose-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100";
  const heading = result.verdict === "genuine" ? "Matches witness evidence" : result.verdict === "fake" ? "Does not match the evidence" : result.verdict === "unknown" ? "Not enough evidence yet" : "We could not read that image";
  return <div role="status" className={`eri-in mt-4 rounded-xl border p-4 ${style}`}><p className="font-semibold">{heading}</p><p className="mt-1 text-sm leading-relaxed opacity-85">{result.message}</p></div>;
}
