"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** Poll a JSON endpoint. Keeps the last good value so the UI never blanks between ticks. */
export function usePoll<T>(url: string, ms = 1500): { data: T | null; reload: () => void } {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const tick = useRef(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    let busy = false;
    let delay = Math.max(ms, 2000); // never hammer the database: serverless hosts have few connections
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      if (busy || document.hidden) return schedule(); // skip while a request is running or the tab is in the background
      busy = true;
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 401) router.replace("/login"); // session expired
        else if (alive && r.ok) {
          setData((await r.json()) as T);
          delay = Math.max(ms, 2000);
        } else if (!r.ok) delay = Math.min(delay * 2, 15000); // server struggling: back off
      } catch {
        delay = Math.min(delay * 2, 15000); // offline blip: keep last value, retry later
      } finally {
        busy = false;
      }
      schedule();
    };
    const schedule = () => {
      if (alive) timer = setTimeout(run, delay);
    };
    run();
    tick.current = n;
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [url, ms, n, router]);
  return { data, reload: () => setN((x) => x + 1) };
}

/** Read a JSON reply without throwing when the server answered with nothing (timeout, gateway error) or with HTML. */
export async function readJson<T = Record<string, unknown>>(r: Response): Promise<T & { error?: string }> {
  const text = await r.text();
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    const why = r.status === 504 || r.status === 502 || r.status === 408 || !text ? "The server took too long to answer." : "The server sent an unexpected reply.";
    return { error: `${why} Please try again.` } as T & { error?: string };
  }
}
