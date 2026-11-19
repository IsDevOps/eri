"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputCls = "w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-sky-400";
const DEMO = [
  { label: "Admin", email: "admin@eri.demo", note: "users · simulators · everything" },
  { label: "Observer", email: "observer@eri.demo", note: "Proof Tree · Live Ear · tribunal packs" },
  { label: "Witness — Amaka", email: "amaka@eri.demo", note: "PU 034 · Igbo" },
  { label: "Witness — Tunde", email: "tunde@eri.demo", note: "PU 034 · Yorùbá + voice" },
];

export function LoginForm({ demo, demoPassword }: { demo: boolean; demoPassword: string }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e?: string, p?: string) {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: e ?? email, password: p ?? password }) });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error ?? "Could not sign in.");
      setBusy(false);
      return;
    }
    // honour ?next only for local paths the role can open; otherwise go to the role's home
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : j.home);
    router.refresh();
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-5 py-14 md:grid-cols-[1fr_340px]">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
        className="space-y-4 rounded-xl border border-white/10 bg-[#121821] p-6"
      >
        <h1 className="text-2xl font-semibold text-white">Sign in</h1>
        <label className="block text-sm text-slate-400">
          Email
          <input className={`${inputCls} mt-1`} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm text-slate-400">
          Password
          <input className={`${inputCls} mt-1`} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-sm text-slate-500">
          New witness? <Link href="/register" className="text-sky-300 hover:underline">Create an account</Link>
        </p>
      </form>

      {demo && (
        <aside className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-300">Accounts</h2>
          {DEMO.map((d) => (
            <button key={d.email} disabled={busy} onClick={() => submit(d.email, demoPassword)} className="block w-full rounded-lg border border-white/10 bg-[#121821] px-3 py-2 text-left hover:border-sky-400 disabled:opacity-50">
              <span className="block text-sm text-white">{d.label}</span>
              <span className="block text-xs text-slate-500">{d.note}</span>
            </button>
          ))}
          {/* <p className="text-[11px] text-slate-500">Quick-login buttons only appear while DEMO_LOGINS=1. Turn it off for any real deployment.</p> */}
        </aside>
      )}
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", phone: "+234", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error ?? "Could not register.");
      setBusy(false);
      return;
    }
    if (j.devCode) sessionStorage.setItem("eri_devcode", j.devCode); // demo mode only: the code the simulated SMS carries
    router.push("/witness");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mx-auto my-14 max-w-md space-y-4 rounded-xl border border-white/10 bg-[#121821] p-6">
      <h1 className="text-2xl font-semibold text-white">Join as a witness</h1>
      <p className="text-sm text-slate-400">Photograph or enter the result sheet at your polling unit. We text you a code to confirm your phone, and later warn you if the number changes on its way to the final announcement.</p>
      {(
        [
          ["name", "Full name", "text", "name"],
          ["email", "Email", "email", "username"],
          ["phone", "Phone (with country code)", "tel", "tel"],
          ["password", "Password (8+ characters)", "password", "new-password"],
        ] as const
      ).map(([k, label, type, ac]) => (
        <label key={k} className="block text-sm text-slate-400">
          {label}
          <input className={`${inputCls} mt-1`} type={type} autoComplete={ac} value={f[k]} onChange={set(k)} required />
        </label>
      ))}
      {err && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-50">
        {busy ? "Creating…" : "Create account"}
      </button>
      <p className="text-sm text-slate-500">
        Already registered? <Link href="/login" className="text-sky-300 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
