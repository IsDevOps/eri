"use client";
import { useEffect, useRef, useState } from "react";

/** Poll a JSON endpoint. Keeps the last good value so the UI never blanks between ticks. */
export function usePoll<T>(url: string, ms = 1500): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const tick = useRef(0);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.status === 401) window.location.href = "/login"; // session expired
        else if (alive && r.ok) setData((await r.json()) as T);
      } catch {
        /* offline blip: keep last value */
      }
    };
    run();
    const id = setInterval(run, ms);
    tick.current = n;
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, ms, n]);
  return { data, reload: () => setN((x) => x + 1) };
}
