import Link from "next/link";
import { HOME, getUser } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { PuCheck } from "@/components/PuCheck";

export default async function Landing() {
  const u = await getUser();
  const s = await q1<{ pus: string; witnessed: string }>(
    "select (select count(*) from polling_unit) as pus, (select count(distinct pu_id) from submission) as witnessed",
  );
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <section>
        <p className="text-sm uppercase tracking-widest text-sky-300">Every Vote, Every Voice</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">Did my polling unit’s result survive the journey?</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-400">
          Ẹ̀rí (Yorùbá: <em>witness, proof</em>) watches the hops between the polling-unit result (Form EC8A) and the final declaration (EC8E), and tells the witnesses the moment a
          number changes. It complements IReV and E Don Kast — it doesn’t replace them.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {u ? (
            <Link href={HOME[u.role]} className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400">
              Go to your workspace →
            </Link>
          ) : (
            <>
              <Link href="/register" className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400">Create an account</Link>
              <Link href="/login" className="rounded-lg border border-white/15 px-5 py-2.5 text-slate-200 hover:bg-white/5">Sign in</Link>
            </>
          )}
          <Link href="/results" className="rounded-lg border border-white/15 px-5 py-2.5 text-slate-200 hover:bg-white/5">See the results trail</Link>
        </div>
      </section>

      <section className="mt-12 grid gap-6 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Check a polling unit — no sign-in needed</h2>
          <PuCheck />
          <p className="mt-2 text-xs text-slate-500">On a basic phone, dial <span className="font-mono">*347*PU#</span> for the same answer.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#121821] p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Polling units witnessed</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-white">
            {s?.witnessed}/{s?.pus}
          </div>
          <p className="mt-2 text-sm text-slate-400">Eriwa LGA · 4 wards · made-up data, neutral party codes A–D.</p>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-300">How a result travels (INEC collation)</h2>
        <p className="mb-4 text-xs text-slate-500">Ẹ̀rí watches every hop after the polling unit. Form names follow INEC’s election guidelines.</p>
        <ol className="grid gap-3 md:grid-cols-5">
          {[
            ["EC8A", "Polling Unit", "Presiding Officer records the result; a copy is posted (EC60E)."],
            ["EC8B", "Ward (Registration Area)", "Ward Collation Officer sums the polling units."],
            ["EC8C", "Local Government Area", "LGA Collation Officer sums the wards."],
            ["EC8D", "State", "State Collation Officer sums the LGAs."],
            ["EC8E", "Declaration and Return", "Returning Officer declares the winner (after national collation for the presidency)."],
          ].map(([form, level, who]) => (
            <li key={form} className="rounded-xl border border-white/10 bg-[#121821] p-4">
              <div className="font-mono text-lg text-sky-300">{form}</div>
              <div className="text-sm font-medium text-white">{level}</div>
              <p className="mt-1 text-xs text-slate-400">{who}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-300">Who can do what</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Citizens (public)", "Check any polling unit by code or USSD, and follow the public results trail: what was announced at each hop and whether it traces to the polling-unit (EC8A) results. Unofficial; INEC declares results.", "No account"],
            ["Witnesses", "Sign in, confirm your phone, submit your polling unit’s EC8A result by photo or figures, get SMS (and voice) alerts in your language if it changes after it leaves the polling unit.", "Self-register"],
            ["Observers", "See the full Proof Tree, run Live Ear on collation audio, and download tribunal evidence packs.", "Self-register"],
          ].map(([t, d, tag]) => (
            <div key={t} className="rounded-xl border border-white/10 bg-[#121821] p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">{t}</h3>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">{tag}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
