"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const inputCls = "w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-sky-400";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
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
    <div className="mx-auto max-w-md px-5 py-14">
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
          New to Ẹ̀rí? <Link href="/register" className="text-sky-300 hover:underline">Create an account</Link>
        </p>
      </form>

    </div>
  );
}

const ROLE_CARDS = [
  { role: "witness", title: "Witness", note: "I was at a polling unit. I photograph or send the result sheet and get alerts about my unit." },
  { role: "observer", title: "Observer", note: "I follow results for a group, party or newsroom. I see the Proof Tree, Live Ear and evidence packs." },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<"witness" | "observer">("witness");
  const [f, setF] = useState({ name: "", email: "", phone: "+234", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, role }) });
    const j = await r.json();
    if (!r.ok) {
      setErr(j.error ?? "Could not register.");
      setBusy(false);
      return;
    }
    if (j.devCode) sessionStorage.setItem("eri_devcode", j.devCode); // only present while SMS delivery is simulated
    router.push(j.home ?? "/witness");
    router.refresh();
  }

  const fields = (
    [
      ["name", "Full name", "text", "name"],
      ["email", "Email", "email", "username"],
      ...(role === "witness" ? ([["phone", "Phone (with country code)", "tel", "tel"]] as const) : []),
      ["password", "Password (8+ characters)", "password", "new-password"],
    ] as const
  );

  return (
    <form onSubmit={submit} className="mx-auto my-14 max-w-md space-y-4 rounded-xl border border-white/10 bg-[#121821] p-6">
      <h1 className="text-2xl font-semibold text-white">Create your account</h1>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm text-slate-400">I am joining as a…</legend>
        {ROLE_CARDS.map((c) => (
          <label
            key={c.role}
            className={`cursor-pointer rounded-lg border p-3 text-sm transition ${role === c.role ? "border-sky-400 bg-sky-400/10" : "border-white/10 hover:border-white/25"}`}
          >
            <input type="radio" name="role" value={c.role} checked={role === c.role} onChange={() => setRole(c.role)} className="sr-only" />
            <span className="block font-medium text-white">{c.title}</span>
            <span className="mt-0.5 block text-xs text-slate-400">{c.note}</span>
          </label>
        ))}
      </fieldset>
      {role === "witness" && <p className="text-sm text-slate-400">We text you a code to confirm your phone, and later warn you if your polling unit’s number changes on its way to the final declaration.</p>}
      {fields.map(([k, label, type, ac]) => (
        <label key={k} className="block text-sm text-slate-400">
          {label}
          <input className={`${inputCls} mt-1`} type={type} autoComplete={ac} value={f[k]} onChange={set(k)} required />
        </label>
      ))}
      {err && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-sky-500 py-2 font-medium text-white hover:bg-sky-400 disabled:opacity-50">
        {busy ? "Creating…" : `Create ${role} account`}
      </button>
      <p className="text-sm text-slate-500">
        Already registered? <Link href="/login" className="text-sky-300 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
