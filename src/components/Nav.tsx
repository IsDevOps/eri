"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Role = "admin" | "observer" | "witness";
export interface NavUser {
  name: string;
  role: Role;
}

const LINKS: Record<Role | "guest", { href: string; label: string }[]> = {
  guest: [
    { href: "/", label: "Check a polling unit" },
    { href: "/results", label: "Results trail" },
  ],
  witness: [
    { href: "/witness", label: "My polling units" },
    { href: "/results", label: "Results trail" },
  ],
  observer: [
    { href: "/dashboard", label: "Proof Tree" },
    { href: "/ear", label: "Live Ear" },
  ],
  admin: [
    { href: "/admin", label: "Admin" },
    { href: "/dashboard", label: "Proof Tree" },
    { href: "/ear", label: "Live Ear" },
    { href: "/phone", label: "Phone simulators" },
  ],
};
const ROLE_LABEL: Record<Role, string> = { admin: "Admin", observer: "Observer", witness: "Witness" };

export function Nav({ user }: { user: NavUser | null }) {
  const path = usePathname();
  const router = useRouter();
  const links = LINKS[user?.role ?? "guest"];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b0f14]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight text-white">Ẹ̀rí</span>
          <span className="hidden text-xs uppercase tracking-widest text-slate-400 sm:inline">witness · proof</span>
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-1.5 text-sm transition ${path === l.href ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <span className="hidden items-center gap-2 lg:flex">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> synthetic demo data
          </span>
          {user ? (
            <>
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-slate-300">
                {user.name} · <span className="text-sky-300">{ROLE_LABEL[user.role]}</span>
              </span>
              <button onClick={logout} className="rounded-md border border-white/10 px-3 py-1.5 text-slate-300 hover:bg-white/10">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-slate-300 hover:text-white">
                Sign in
              </Link>
              <Link href="/register" className="rounded-md bg-sky-500 px-3 py-1.5 font-medium text-white hover:bg-sky-400">
                Join as a witness
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Shown when the proxy/layout redirected the user away from a section their role can't open (?denied=1). */
export function DeniedNotice() {
  const denied = useSearchParams().get("denied");
  if (!denied) return null;
  return (
    <div role="alert" className="border-b border-amber-400/30 bg-amber-400/10 px-5 py-2 text-center text-sm text-amber-200">
      You don’t have access to that page with this account. Sign in with a different role to open it.
    </div>
  );
}
