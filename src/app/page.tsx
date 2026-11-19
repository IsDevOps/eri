import Link from "next/link";
import { HOME, getUser } from "@/lib/auth";
import { q1 } from "@/lib/db";
import { PublicTrustDesk } from "@/components/PublicTrustDesk";
import { PublicNavbar } from "@/components/NavBar";

export default async function Landing() {
  const u = await getUser();
  const s = await q1<{ pus: string; witnessed: string }>(
    "select (select count(*) from polling_unit) as pus, (select count(distinct pu_id) from submission) as witnessed",
  );
  return (
<>
       <PublicNavbar />
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
      <section className="grid items-end gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-sky-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Every vote, every voice</div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl">Did the result on your wall survive the journey?</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Ẹ̀rí (Yorùbá: <em>witness, proof</em>) turns a photo on a polling-unit wall into a traceable public record. It checks each hand-off, alerts witnesses when numbers move, and separates evidence from rumours.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
          {u ? (
            <Link href={HOME[u.role]} className="rounded-lg bg-sky-500 px-5 py-2.5 font-medium text-white hover:bg-sky-400">
              Go to your workspace →
            </Link>
          ) : (
            <>
              <Link href="/register" className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-300">Create an account</Link>
              <a href="#trust-desk" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/5">Use the trust desk</a>
            </>
          )}
          </div>
        </div>
        <aside className="rounded-3xl border border-white/10 bg-[#121a25] p-5 shadow-xl shadow-black/20">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Live Coverage</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-white"><span className="text-emerald-300">{s?.witnessed}</span>/{s?.pus}</p>
          <p className="mt-1 text-sm text-slate-400">polling-unit walls independently witnessed</p>
          <div className="my-5 h-px bg-white/10" />
          <p className="text-sm leading-relaxed text-slate-300">A result only earns confidence when its trail is visible—not when it is forwarded the most.</p>
          <p className="mt-4 text-xs text-slate-500"> Eriwa LGA  · neutral party codes A–D</p>
        </aside>
      </section>

      <section id="trust-desk" className="mt-12 scroll-mt-24">
        <PublicTrustDesk />
        <p className="mt-3 text-center text-xs text-slate-500">On a basic phone, dial <span className="font-mono text-slate-400">*347*PU#</span> for the polling-unit evidence summary.</p>
      </section>

      <section className="mt-14">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-200">Designed for the whole chain</p><h2 className="eri-section-heading mt-1 text-2xl font-semibold text-white">One clear action for every person involved.</h2></div><span className="text-sm text-slate-500">Evidence before amplification.</span></div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Citizens (public)", "Check any polling unit by code or USSD, and follow the public results trail: what was announced at each hop and whether it traces to the polling-unit (EC8A) results. Unofficial; INEC declares results.", "No account"],
            ["Witnesses", "Sign in, confirm your phone, submit your polling unit’s EC8A result by photo or figures, get SMS (and voice) alerts in your language if it changes after it leaves the polling unit.", "Self-register"],
            ["Observers", "See the full Proof Tree, run Live Ear on collation audio, and download tribunal evidence packs.", "Self-register"],
          ].map(([t, d, tag]) => (
            <div key={t} className="rounded-2xl border border-white/10 bg-[#121a25] p-5 transition hover:-translate-y-0.5 hover:border-sky-300/25">
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
</>
  );
}
