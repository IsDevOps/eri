import Link from "next/link";

/** Top bar for the public pages (landing, sign-in, sign-up). Signed-in visitors get a link back to their workspace instead. */
export function PublicNavbar({ user }: { user?: { name: string; home: string } | null }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0f14]/90 backdrop-blur-xl" aria-label="Public navigation">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Ẹ̀rí home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400 text-sm font-bold text-slate-950">Ẹ</span>
          <span className="text-lg font-bold tracking-tight text-white">Ẹ̀rí</span>
        </Link>

        <div className="flex items-center gap-1 whitespace-nowrap sm:gap-3">
          <Link href="/results" className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:px-3">
            <span className="sm:hidden">Results</span>
            <span className="hidden sm:inline">Results trail</span>
          </Link>
          {user ? (
            <Link href={user.home} className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
              Open workspace →
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-2.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white sm:px-3">
                Sign in
              </Link>
              <Link href="/register" className="rounded-lg bg-sky-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300 sm:px-4">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
