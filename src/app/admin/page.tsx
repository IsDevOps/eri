"use client";
import Link from "next/link";
import { useState } from "react";
import { usePoll } from "@/lib/client";

interface User { id: number; email: string; name: string; role: "admin" | "observer" | "witness"; phone: string | null; phone_verified: boolean; disabled: boolean; created_at: string }
interface AuditRow { id: number; event: string; detail: Record<string, unknown> | null; created_at: string }

const card = "rounded-xl border border-white/10 bg-[#121821] p-5";
const input = "rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-sky-400";
const send = (method: string, url: string, body?: unknown) =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });

export default function Admin() {
  const { data: users, reload } = usePoll<User[]>("/api/admin/users", 5000);
  const { data: audit } = usePoll<AuditRow[]>("/api/admin/audit", 4000);
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ name: "", email: "", role: "observer", phone: "", password: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await send("POST", "/api/admin/users", f);
    const j = await r.json();
    setMsg(r.ok ? `Created ${j.email}` : j.error);
    if (r.ok) {
      setF({ name: "", email: "", role: "observer", phone: "", password: "" });
      reload();
    }
  }
  async function patch(id: number, body: object) {
    const r = await send("PATCH", "/api/admin/users", { id, ...body });
    const j = await r.json();
    setMsg(r.ok ? "Saved" : j.error);
    reload();
  }
  async function resetPw(u: User) {
    const pw = prompt(`New password for ${u.email} (8+ characters)`);
    if (pw) patch(u.id, { password: pw });
  }
  async function reset() {
    if (!confirm("Clear live activity (alerts, messages, collation events, phone submissions)? Accounts and polling-unit data are kept.")) return;
    const r = await send("POST", "/api/admin/reset");
    setMsg(r.ok ? "Live activity cleared." : "Reset failed.");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Administration</h1>
          <p className="text-sm text-slate-400">Accounts, roles and system controls. Only admins can see this page.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/phone" className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Field channels</Link>
          <button onClick={reset} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">↺ Clear live activity</button>
        </div>
      </header>
      {msg && <p role="status" className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">{msg}</p>}

      <section className={card}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr><th className="py-2 pr-3">Name</th><th className="pr-3">Email</th><th className="pr-3">Phone</th><th className="pr-3">Role</th><th className="pr-3">Status</th><th /></tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-white">{u.name}</td>
                  <td className="pr-3 text-slate-300">{u.email}</td>
                  <td className="pr-3 font-mono text-xs text-slate-400">{u.phone ?? "—"} {u.phone && (u.phone_verified ? "✓" : "(unverified)")}</td>
                  <td className="pr-3">
                    <select className={input} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} aria-label={`Role for ${u.email}`}>
                      <option value="admin">admin</option><option value="observer">observer</option><option value="witness">witness</option>
                    </select>
                  </td>
                  <td className="pr-3">{u.disabled ? <span className="text-red-300">disabled</span> : <span className="text-emerald-300">active</span>}</td>
                  <td className="space-x-2 whitespace-nowrap text-right">
                    <button onClick={() => patch(u.id, { disabled: !u.disabled })} className="text-xs text-slate-400 hover:text-white">{u.disabled ? "Enable" : "Disable"}</button>
                    <button onClick={() => resetPw(u)} className="text-xs text-slate-400 hover:text-white">Set password</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={create} className={`${card} space-y-3`}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Add a user</h2>
          <div className="grid grid-cols-2 gap-2">
            <input className={input} placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
            <input className={input} type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
            <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="observer">observer</option><option value="witness">witness</option><option value="admin">admin</option>
            </select>
            <input className={input} placeholder="Phone (witness only)" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input className={`${input} col-span-2`} type="password" placeholder="Initial password (8+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          </div>
          <button className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400">Create user</button>
        </form>

        <section className={card}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Recent account & system events</h2>
          <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
            {audit?.map((a) => (
              <li key={a.id} className="flex gap-2 border-b border-white/5 py-1">
                <span className="shrink-0 text-slate-500">{new Date(a.created_at).toLocaleTimeString()}</span>
                <span className="shrink-0 font-medium text-sky-300">{a.event}</span>
                <span className="truncate font-mono text-slate-500">{a.detail ? JSON.stringify(a.detail) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
