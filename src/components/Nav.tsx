"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Role = "admin" | "observer" | "witness";
type NavIcon = "wall" | "tree" | "ear" | "admin" | "phone";

interface NavLink {
  href: string;
  label: string;
  icon: NavIcon;
  hint?: string;
}

export interface NavUser {
  name: string;
  role: Role;
}

const LINKS: Record<Role | "guest", NavLink[]> = {
  guest: [{ href: "/", label: "Trust desk", icon: "wall", hint: "Check a wall or report a concern" }],
  witness: [{ href: "/witness", label: "My wall evidence", icon: "wall", hint: "Submit and follow your result" }],
  observer: [
    { href: "/dashboard", label: "Proof Tree", icon: "tree", hint: "Trace every collation hop" },
    { href: "/ear", label: "Live Ear", icon: "ear", hint: "Listen and reconcile live" },
  ],
  admin: [
    { href: "/admin", label: "Administration", icon: "admin", hint: "Accounts and demo controls" },
    { href: "/dashboard", label: "Proof Tree", icon: "tree", hint: "Trace every collation hop" },
    { href: "/ear", label: "Live Ear", icon: "ear", hint: "Listen and reconcile live" },
    { href: "/phone", label: "Phone simulators", icon: "phone", hint: "SMS, USSD and WhatsApp" },
  ],
};

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", observer: "Observer", witness: "Witness" };

function Mark() {
  return (
    <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-sky-300 text-lg font-black text-slate-950 shadow-lg shadow-emerald-950/20">
      E
    </span>
  );
}

function NavGlyph({ icon }: { icon: NavIcon }) {
  const shared = "h-[18px] w-[18px] fill-none stroke-current stroke-[1.8]";
  if (icon === "tree") return <svg aria-hidden="true" viewBox="0 0 24 24" className={shared}><circle cx="12" cy="5" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><path d="M12 7v4M6 16v-2h12v2M12 11v3" /></svg>;
  if (icon === "ear") return <svg aria-hidden="true" viewBox="0 0 24 24" className={shared}><path d="M7 11.5a5 5 0 1 1 10 0c0 3-2.2 3.5-2.8 5.5-.3 1-.6 2-2.2 2-1.2 0-2-.8-2-2" /><path d="M11 22h2" /></svg>;
  if (icon === "admin") return <svg aria-hidden="true" viewBox="0 0 24 24" className={shared}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3" /></svg>;
  if (icon === "phone") return <svg aria-hidden="true" viewBox="0 0 24 24" className={shared}><rect x="6" y="2.5" width="12" height="19" rx="2" /><path d="M10 18.5h4M9 5.5h6" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={shared}><path d="M4 4.5h16v15H4z" /><path d="M7 8h10M7 12h5M7 16h7" /></svg>;
}

function MenuIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="m6 6 12 12M18 6 6 18" /></svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
      <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
    </svg>
  );
}

type Theme = "light" | "dark";
const THEME_CHANGE = "eri-theme-change";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribeTheme(listener: () => void) {
  window.addEventListener(THEME_CHANGE, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(THEME_CHANGE, listener);
    window.removeEventListener("storage", listener);
  };
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("eri-theme", theme);
  window.dispatchEvent(new Event(THEME_CHANGE));
}

function ThemeToggle() {
  // Keeps the mobile and sidebar controls in sync, including after a system/storage change.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "dark");

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-sky-100"
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/** A role-aware app shell: permanent on larger screens, a focusable drawer on phones. */
export function Nav({ user }: { user: NavUser | null }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = LINKS[user?.role ?? "guest"];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const closeDrawer = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#0b0f14]/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" onClick={closeDrawer} className="flex items-center gap-2.5" aria-label="Ẹ̀rí home">
          <Mark />
          <span>
            <span className="block text-lg font-semibold tracking-tight text-white">Ẹ̀rí</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">witness · proof</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls="primary-navigation"
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-sky-300/40 hover:bg-sky-300/10 hover:text-white"
          >
            <span className="sr-only">{open ? "Close navigation" : "Open navigation"}</span>
            <MenuIcon open={open} />
          </button>
        </div>
      </header>

      {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" aria-label="Close navigation" onClick={closeDrawer} />}

      <aside className={`${open ? "fixed inset-y-0 left-0 flex w-[min(19rem,88vw)]" : "hidden"} z-50 flex-col border-r border-white/10 bg-[#0d131c] shadow-2xl shadow-black/40 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-auto lg:shadow-none`}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
          <div className="mb-8 hidden items-center gap-2.5 px-2 lg:flex">
            <Mark />
            <Link href="/" className="group" aria-label="Ẹ̀rí home">
              <span className="block text-xl font-semibold tracking-tight text-white group-hover:text-sky-100">Ẹ̀rí</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">witness · proof</span>
            </Link>
          </div>

          <div className="mb-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />  live</div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">Made-up data only. Evidence states update as the demo moves.</p>
          </div>

          <nav id="primary-navigation" aria-label="Primary navigation">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{user ? "Workspace" : "Public access"}</p>
            <div className="space-y-1">
              {links.map((link) => {
                const active = path === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeDrawer}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 transition ${active ? "bg-sky-300/10 text-white shadow-sm shadow-sky-950/20" : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"}`}
                  >
                    {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sky-300" />}
                    <span className={`grid h-9 w-9 place-items-center rounded-lg transition ${active ? "bg-sky-300 text-slate-950" : "bg-white/[0.06] text-slate-400 group-hover:bg-white/10 group-hover:text-sky-200"}`}><NavGlyph icon={link.icon} /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{link.label}</span>{link.hint && <span className="mt-0.5 block truncate text-xs font-normal text-slate-500 group-hover:text-slate-400">{link.hint}</span>}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {!user && (
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold text-white">Witness what you saw.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Submit a wall, get an alert if it changes, and choose your language.</p>
              <Link href="/register" onClick={closeDrawer} className="mt-3 flex min-h-10 items-center justify-center rounded-lg bg-sky-300 px-3 text-xs font-semibold text-slate-950 transition hover:bg-sky-200">Join as a witness</Link>
              <Link href="/login" onClick={closeDrawer} className="mt-2 flex min-h-9 items-center justify-center rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white">Sign in</Link>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-500">Appearance</span>
            <ThemeToggle />
          </div>
          {user ? (
            <div className="rounded-2xl bg-white/[0.045] p-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-300/90 to-emerald-300/90 text-xs font-bold text-slate-950">{user.name.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-100">{user.name}</span><span className="block text-xs text-sky-200">{ROLE_LABEL[user.role]}</span></span>
              </div>
              <button onClick={logout} className="mt-3 flex min-h-9 w-full items-center justify-center rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-100">Sign out</button>
            </div>
          ) : (
            <p className="px-2 text-xs leading-relaxed text-slate-500">Evidence before amplification.</p>
          )}
        </div>
      </aside>
    </>
  );
}

/** Shown when the proxy/layout redirected the user away from a section their role can't open (?denied=1). */
export function DeniedNotice() {
  const denied = useSearchParams().get("denied");
  if (!denied) return null;
  return (
    <div role="alert" className="border-b border-amber-400/30 bg-amber-400/10 px-5 py-2 text-center text-sm text-amber-100">
      You don’t have access to that page with this account. Sign in with a different role to open it.
    </div>
  );
}
