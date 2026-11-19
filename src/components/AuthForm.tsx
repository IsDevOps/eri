"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// 16px text on phones stops iOS from zooming the page when a field is focused; 44px height is a comfortable touch target.
const inputCls =
  "w-full min-h-11 rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-base text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 sm:text-sm";
const primaryBtn =
  "flex min-h-11 w-full items-center justify-center rounded-lg bg-sky-500 px-4 py-2 font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50";

/** Centres the card in the space under the public bar, with a brand mark, title and an optional note underneath. */
function AuthShell({ title, subtitle, children, below }: { title: string; subtitle: string; children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4.1rem)] w-full max-w-md flex-col justify-center px-4 py-8 sm:px-5 sm:py-12">
      <div className="rounded-2xl border border-white/10 bg-[#121821] p-5 shadow-xl shadow-black/20 sm:p-8">
        <div className="mb-6 text-center">
          <span aria-hidden="true" className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-sky-300 text-lg font-black text-slate-950">Ẹ</span>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        {children}
      </div>
      {below && <div className="mt-5 text-center text-sm text-slate-500">{below}</div>}
    </main>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
      {text}
    </p>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm text-slate-400">
      {label}
      <span className="relative mt-1 block">
        <input
          className={`${inputCls} pr-16`}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          className="absolute inset-y-0 right-1 my-1 rounded-md px-3 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white"
        >
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}

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
    try {
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
    } catch {
      setErr("Can’t reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Ẹ̀rí workspace."
      below={
        <>
          <span className="block">Only checking a result? You don’t need an account.</span>
          <Link href="/#trust-desk" className="mt-1 inline-block text-sky-300 hover:underline">Open the Trust Desk →</Link>
        </>
      }
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <label className="block text-sm text-slate-400">
          Email
          <input className={`${inputCls} mt-1`} type="email" inputMode="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        {err && <ErrorNote text={err} />}
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 border-t border-white/10 pt-5 text-center text-sm text-slate-500">
        New to Ẹ̀rí? <Link href="/register" className="font-medium text-sky-300 hover:underline">Create an account</Link>
      </p>
    </AuthShell>
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
    try {
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
    } catch {
      setErr("Can’t reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose how you will use Ẹ̀rí."
      below={
        <>
          Already registered? <Link href="/login" className="text-sky-300 hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <fieldset className="grid gap-2">
          <legend className="sr-only">I am joining as a</legend>
          {ROLE_CARDS.map((c) => (
            <label
              key={c.role}
              className={`cursor-pointer rounded-lg border p-3 text-sm transition focus-within:ring-2 focus-within:ring-sky-400/40 ${role === c.role ? "border-sky-400 bg-sky-400/10" : "border-white/10 hover:border-white/25"}`}
            >
              <input type="radio" name="role" value={c.role} checked={role === c.role} onChange={() => setRole(c.role)} className="sr-only" />
              <span className="block font-medium text-white">{c.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{c.note}</span>
            </label>
          ))}
        </fieldset>
        <label className="block text-sm text-slate-400">
          Full name
          <input className={`${inputCls} mt-1`} type="text" autoComplete="name" value={f.name} onChange={set("name")} required />
        </label>
        <label className="block text-sm text-slate-400">
          Email
          <input className={`${inputCls} mt-1`} type="email" inputMode="email" autoComplete="username" placeholder="you@example.com" value={f.email} onChange={set("email")} required />
        </label>
        {role === "witness" && (
          <label className="block text-sm text-slate-400">
            Phone (with country code)
            <input className={`${inputCls} mt-1`} type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} required />
            <span className="mt-1 block text-xs text-slate-500">We text you a code to confirm it, and warn you if your polling unit’s result changes on its way to the declaration.</span>
          </label>
        )}
        <PasswordField label="Password (8+ characters)" value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" />
        {err && <ErrorNote text={err} />}
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Creating…" : `Create ${role} account`}
        </button>
      </form>
    </AuthShell>
  );
}
