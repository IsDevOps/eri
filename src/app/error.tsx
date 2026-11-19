"use client";
import Link from "next/link";

/** Shown when a page fails on the server (for example the database is briefly unreachable). */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-xl font-semibold text-white">Something went wrong on our side</h1>
      <p className="mt-2 text-sm text-slate-400">The page could not load. This is usually brief — try again in a moment.</p>
      <div className="mt-5 flex gap-3">
        <button onClick={reset} className="min-h-11 rounded-lg bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-400">Try again</button>
        <Link href="/" className="flex min-h-11 items-center rounded-lg border border-white/15 px-4 text-sm text-slate-300 hover:bg-white/5">Go to home</Link>
      </div>
    </main>
  );
}
