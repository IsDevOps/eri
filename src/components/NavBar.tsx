import Link from "next/link";

export function PublicNavbar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0f14]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400 text-sm font-bold text-slate-950">
            Ẹ
          </div>

          <span className="text-lg font-bold tracking-tight text-white">
            Ẹ̀rí
          </span>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Sign in
          </Link>

          <Link
            href="/register"
            className="rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            Sign up
          </Link>
        </div>
      </div>
    </nav>
  );
}