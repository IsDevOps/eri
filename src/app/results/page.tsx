"use client";
import { Pill, TallyChips } from "@/components/TreeView";
import { usePoll } from "@/lib/client";
import type { PublicTrail, TrailRow } from "@/lib/public-trail";

const LEVEL_LABEL: Record<TrailRow["level"], string> = {
  state: "State · EC8D",
  lga: "Local Government Area · EC8C",
  ward: "Ward (Registration Area) · EC8B",
};

function Row({ r }: { r: TrailRow }) {
  const bad = r.status === "flagged";
  return (
    <li
      style={{ marginLeft: `${r.depth * 20}px` }}
      className={`rounded-xl border p-4 ${bad ? "border-red-500/40 bg-red-500/5" : "border-white/10 bg-[#121821]"}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{LEVEL_LABEL[r.level]}</span>
        <h3 className="font-medium text-white">{r.label}</h3>
        <Pill status={r.status} />
        <span className="ml-auto text-xs text-slate-500">
          {r.coverage.witnessed}/{r.coverage.total} polling units witnessed
        </span>
      </div>
      <p className={`mt-1 text-sm ${bad ? "text-red-200" : "text-slate-300"}`}>{r.headline}</p>

      {r.announced ? (
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Announced</dt>
            <dd className="mt-1">
              <TallyChips t={r.announced} gap={bad ? r.gap : null} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">
              {r.level === "ward" ? "Sum of witnessed EC8A results" : r.level === "lga" ? "Sum of announced wards" : "Sum of announced LGAs"}
            </dt>
            <dd className="mt-1">
              <TallyChips t={r.checkedAgainst} />
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-2 text-xs text-slate-400">{r.reason}</p>
    </li>
  );
}

export default function Results() {
  const { data } = usePoll<PublicTrail>("/api/public/trail", 3000);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm uppercase tracking-widest text-sky-300">Results trail</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">What was announced, and does it trace to the polling-unit results?</h1>

      <div role="note" className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        {data?.disclaimer ??
          "Unofficial. This page shows what was announced at each collation hop and whether it traces to polling-unit results (Form EC8A) that citizens witnessed. It is not a result and does not predict one. INEC declares the official result."}
      </div>

      {!data ? (
        <p className="mt-8 text-slate-400">Loading…</p>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Hops announced", String(data.summary.announcedHops)],
              ["Traced to EC8A", String(data.summary.tracedHops)],
              ["Flagged", String(data.summary.flaggedHops)],
              ["Polling units witnessed", `${data.summary.pollingUnits.witnessed}/${data.summary.pollingUnits.total}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-[#121821] p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{k}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{v}</div>
              </div>
            ))}
          </section>

          <ul className="mt-6 space-y-3">
            {data.rows.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>

          <p className="mt-6 text-xs text-slate-500">
            Updated {new Date(data.updatedAt).toLocaleTimeString()} · refreshes automatically · synthetic demo data (Eriwa LGA, neutral party codes A–D).
            Figures are shown in fixed party order. Nothing here ranks parties. To check a single polling unit, use the lookup on the home page or dial{" "}
            <span className="font-mono">*347*PU#</span>.
          </p>
        </>
      )}
    </main>
  );
}
