"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pill } from "@/components/TreeView";
import { PARTIES, fmt, type Tally } from "@/lib/config";
import { usePoll } from "@/lib/client";
import type { TreeNode } from "@/lib/reconcile";

interface Clip {
  file: string;
  label: string;
  transcript: string;
}
interface Heard {
  id: number;
  text: string;
  entries: { entry: { level: string; ward?: number; pu?: string; tally?: Tally; dropped?: boolean }; result: { recorded?: boolean; skipped?: string; alerts?: { message: string }[] } }[];
  engine: string;
}

/** Split a transcript into announcement segments so each hop is reconciled as soon as it is spoken. */
function segment(text: string): string[] {
  return text.split(/(?=\b(?:ward|polling unit|local government|lga total|state total)\b)/i).map((s) => s.trim()).filter(Boolean);
}

export default function LiveEar() {
  const { data: tree } = usePoll<TreeNode>("/api/tree", 1000);
  const [clips, setClips] = useState<Clip[]>([]);
  const [revealed, setRevealed] = useState("");
  const [heard, setHeard] = useState<Heard[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [recording, setRecording] = useState(false);
  const ctxRef = useRef<{ ward?: number }>({});
  const hid = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    fetch("/demo/audio/clips.json").then((r) => (r.ok ? r.json() : [])).then(setClips).catch(() => {});
  }, []);

  const ingest = useCallback(async (text: string) => {
    const r = await fetch("/api/ear/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: text, ctx: ctxRef.current }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error ?? "ingest failed");
      return;
    }
    ctxRef.current = j.ctx ?? ctxRef.current;
    setHeard((h) => [{ id: ++hid.current, text, entries: j.entries, engine: j.engine }, ...h]);
  }, []);

  /** Play a clip: transcribe it, reveal the transcript in time with the audio, reconcile each announcement as it lands. */
  const playClip = async (c: Clip) => {
    setError(null);
    setBusy(c.file);
    setRevealed("");
    ctxRef.current = {};
    try {
      const blob = await (await fetch(`/demo/audio/${c.file}`)).blob();
      const fd = new FormData();
      fd.set("file", new File([blob], c.file, { type: "audio/wav" }));
      const r = await fetch("/api/ear/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const text: string = j.text;
      const segs = segment(text);
      const ends: number[] = [];
      let acc = 0;
      for (const s of segs) {
        acc += s.length + 1;
        ends.push(acc);
      }
      const total = acc;
      let done = 0;
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      const tick = async () => {
        const p = audio.duration ? audio.currentTime / audio.duration : 0;
        const chars = Math.min(total, Math.floor(p * total * 1.02));
        setRevealed(text.slice(0, chars));
        while (done < segs.length && chars >= ends[done] - 1) {
          const s = segs[done++];
          await ingest(s);
        }
      };
      audio.ontimeupdate = tick;
      audio.onended = async () => {
        setRevealed(text);
        while (done < segs.length) await ingest(segs[done++]);
        setBusy(null);
      };
      await audio.play().catch(() => {
        /* autoplay blocked: fall back to instant processing */
        audio.onended?.(new Event("ended"));
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const uploadAudio = async (file: File) => {
    setError(null);
    setBusy("upload");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const r = await fetch("/api/ear/transcribe", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRevealed((p) => (p ? p + " " : "") + j.text);
      for (const s of segment(j.text)) await ingest(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleMic = async () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let live = true;
      setRecording(true);
      recRef.current = {
        stop: () => {
          live = false;
        },
      };
      const loop = async () => {
        while (live) {
          const rec = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          rec.ondataavailable = (e) => chunks.push(e.data);
          const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
          rec.start();
          await new Promise((r) => setTimeout(r, 7000));
          rec.stop();
          await stopped;
          const blob = new Blob(chunks, { type: rec.mimeType });
          const fd = new FormData();
          fd.set("file", new File([blob], "chunk.webm", { type: rec.mimeType }));
          try {
            const r = await fetch("/api/ear/transcribe", { method: "POST", body: fd });
            const j = await r.json();
            if (r.ok && j.text?.trim()) {
              setRevealed((p) => p + " " + j.text);
              for (const s of segment(j.text)) await ingest(s);
            } else if (!r.ok) setError(j.error);
          } catch (e) {
            setError((e as Error).message);
          }
        }
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
      };
      loop();
    } catch {
      setError("Microphone not available in this browser.");
    }
  };

  const wards = tree?.children[0]?.children ?? [];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-sm uppercase tracking-widest text-sky-300">Signature feature 1</p>
      <h1 className="mt-1 text-3xl font-semibold text-white">Live Ear — the collation centre, checked in real time</h1>
      <p className="mt-2 max-w-3xl text-slate-400">
        Returning officers read results aloud. Ẹ̀rí listens, transcribes, pulls out the figures per ward or LGA and compares them with the
        polling-unit totals the witnesses already posted. Play a clip, record from the room, or upload audio.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#121821] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Audio source</h2>
            <div className="space-y-2">
              {clips.map((c) => (
                <button
                  key={c.file}
                  disabled={!!busy}
                  onClick={() => playClip(c)}
                  className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm transition hover:border-sky-400/50 hover:bg-sky-400/10 disabled:opacity-50"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/20 text-sky-300">{busy === c.file ? "…" : "▶"}</span>
                  <span className="text-slate-200">{c.label}</span>
                </button>
              ))}
              {!clips.length && <p className="text-sm text-slate-500">No demo clips yet. Run <code>npm run seed</code>.</p>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={toggleMic}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${recording ? "animate-pulse bg-red-500 text-white" : "bg-white/10 text-slate-200 hover:bg-white/15"}`}
              >
                {recording ? "● Listening… tap to stop" : "🎙 Listen live (mic)"}
              </button>
              <label className="cursor-pointer rounded-lg bg-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/15">
                Upload audio
                <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])} />
              </label>
            </div>
            <div className="mt-4">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">Or paste what was announced</label>
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={3}
                placeholder='Ward four total. Party A three thousand one hundred and twenty. Party B …'
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-slate-200 outline-none focus:border-sky-400/60"
              />
              <button
                disabled={!pasted.trim() || !!busy}
                onClick={async () => {
                  setRevealed((p) => p + " " + pasted);
                  for (const s of segment(pasted)) await ingest(s);
                  setPasted("");
                }}
                className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Reconcile
              </button>
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-500/10 p-2 text-sm text-red-300">{error}</p>}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#121821] p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">Live transcript</h2>
            <p className="min-h-[5rem] whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {revealed || <span className="text-slate-600">Waiting for the collation centre…</span>}
              {busy && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-sky-400 align-middle" />}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#121821] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">Wards — announced vs witnessed</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {wards.map((w) => (
                <div
                  key={w.id}
                  className={`rounded-lg border p-3 ${w.status === "flagged" ? "eri-flash border-red-500/50 bg-red-500/10" : "border-white/10 bg-white/5"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{w.label.split(" · ")[0]}</span>
                    <Pill status={w.status} />
                  </div>
                  <div className="mt-2 space-y-0.5 font-mono text-xs tabular-nums">
                    {PARTIES.slice(0, 1).map((p) => (
                      <div key={p} className="flex justify-between text-slate-400">
                        <span>Announced {p}</span>
                        <span className={w.gap && w.gap[p] ? "text-red-300" : "text-slate-200"}>{w.announced ? fmt(w.announced[p] ?? 0) : "—"}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-slate-400">
                      <span>Posted by {w.coverage.witnessed} PUs</span>
                      <span className="text-slate-200">{fmt(w.wallSum.A ?? 0)}</span>
                    </div>
                    {w.gap && w.gap.A ? (
                      <div className={`flex justify-between font-semibold ${w.status === "flagged" ? "text-red-300" : "text-amber-300"}`}>
                        <span>{w.status === "flagged" ? "Unexplained" : "Needs unwitnessed PUs"}</span>
                        <span>
                          {w.gap.A > 0 ? "+" : ""}
                          {fmt(w.gap.A)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {wards.some((w) => w.status === "flagged") && (
              <p className="eri-in mt-3 rounded-lg bg-red-500/15 p-3 text-sm text-red-200">
                {wards.find((w) => w.status === "flagged")?.reason}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#121821] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">What Ẹ̀rí heard</h2>
            {!heard.length && <p className="text-sm text-slate-500">Nothing yet.</p>}
            <ul className="space-y-2">
              {heard.map((h) =>
                h.entries.map((e, i) => (
                  <li key={`${h.id}-${i}`} className="eri-in rounded-lg bg-white/5 p-3 text-sm">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
                      <span>
                        {e.entry.level === "pu_at_ward" ? `PU ${e.entry.pu} read at ward` : e.entry.level === "ward" ? `Ward ${String(e.entry.ward).padStart(2, "0")} total` : e.entry.level === "lga" ? "LGA total" : "State total"}
                      </span>
                      <span>{h.engine === "claude" ? "AI extract" : "rule extract"}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs tabular-nums text-slate-200">
                      {e.entry.tally ? PARTIES.map((p) => `${p} ${fmt(e.entry.tally![p] ?? 0)}`).join("  ") : e.entry.dropped ? "dropped" : ""}
                    </div>
                    {e.result.alerts?.map((a, k) => (
                      <p key={k} className="mt-2 rounded bg-red-500/15 px-2 py-1 text-xs text-red-200">🚩 {a.message}</p>
                    ))}
                    {e.result.skipped && <p className="mt-1 text-xs text-slate-500">skipped: {e.result.skipped}</p>}
                  </li>
                )),
              )}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
