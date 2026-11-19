"use client";
import { useEffect, useRef, useState } from "react";
import { PARTIES, fmt, tallyTotal, type Tally } from "@/lib/config";
import type { Status, TreeNode } from "@/lib/reconcile";

export const STATUS_STYLE: Record<Status, { label: string; pill: string; dot: string }> = {
  verified: { label: "Traced", pill: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", dot: "bg-emerald-400" },
  flagged: { label: "Flagged", pill: "bg-red-500/20 text-red-300 ring-red-500/50", dot: "bg-red-500" },
  contested: { label: "Contested", pill: "bg-amber-500/15 text-amber-300 ring-amber-500/30", dot: "bg-amber-400" },
  unverified: { label: "Partly proven", pill: "bg-amber-500/15 text-amber-300 ring-amber-500/30", dot: "bg-amber-400" },
  pending: { label: "Awaiting", pill: "bg-slate-500/15 text-slate-400 ring-slate-500/30", dot: "bg-slate-500" },
};

export function Pill({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function TallyChips({ t, gap }: { t: Tally | null; gap?: Tally | null }) {
  if (!t) return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-xs tabular-nums">
      {PARTIES.map((p) => {
        const g = gap?.[p] ?? 0;
        return (
          <span key={p} className={g !== 0 ? "text-red-300" : "text-slate-300"}>
            <span className="text-slate-500">{p}</span> {fmt(t[p] ?? 0)}
            {g !== 0 && <span className="ml-1 rounded bg-red-500/25 px-1 text-red-200">{g > 0 ? "+" : ""}{fmt(g)}</span>}
          </span>
        );
      })}
    </span>
  );
}

function collectIds(n: TreeNode, out: Map<string, Status> = new Map()) {
  out.set(n.id, n.status);
  n.children.forEach((c) => collectIds(c, out));
  return out;
}

export function TreeView({
  root,
  selectedId,
  onSelect,
}: {
  root: TreeNode;
  selectedId: string | null;
  onSelect: (n: TreeNode) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set([root.id, ...root.children.map((c) => c.id)]));
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const prev = useRef<Map<string, Status> | null>(null);

  // Detect nodes that just turned red -> flash them and auto-open their path so the audience sees it.
  useEffect(() => {
    const now = collectIds(root);
    if (prev.current) {
      const fresh: string[] = [];
      now.forEach((s, id) => {
        if (s === "flagged" && prev.current!.get(id) !== "flagged") fresh.push(id);
      });
      if (fresh.length) {
        setFlashing((f) => new Set([...f, ...fresh]));
        setOpen((o) => {
          const next = new Set(o);
          const mark = (n: TreeNode): boolean => {
            const hit = fresh.includes(n.id) || n.children.map(mark).some(Boolean);
            if (hit) next.add(n.id);
            return hit;
          };
          mark(root);
          return next;
        });
        setTimeout(() => setFlashing((f) => new Set([...f].filter((x) => !fresh.includes(x)))), 4000);
      }
    }
    prev.current = now;
  }, [root]);

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const renderRow = (n: TreeNode, depth: number) => {
    const isOpen = open.has(n.id);
    const has = n.children.length > 0;
    const sel = selectedId === n.id;
    const red = n.status === "flagged";
    return (
      <div key={n.id}>
        <div
          onClick={() => {
            onSelect(n);
            if (has) toggle(n.id);
          }}
          className={`group flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
            sel ? "border-sky-400/60 bg-sky-400/10" : red ? "border-red-500/40 bg-red-500/10" : "border-transparent hover:bg-white/5"
          } ${flashing.has(n.id) ? "eri-flash" : ""}`}
          style={{ marginLeft: depth * 18 }}
        >
          <span className="w-4 text-center text-xs text-slate-500">{has ? (isOpen ? "▾" : "▸") : "·"}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`truncate text-sm ${n.level === "pu" ? "font-mono text-slate-300" : "font-medium text-white"}`}>{n.label}</span>
              {n.level !== "pu" && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {n.coverage.witnessed}/{n.coverage.total} PUs witnessed
                </span>
              )}
              {n.level === "pu" && !!n.witnesses && (
                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">{n.witnesses} witnesses</span>
              )}
            </div>
            <div className="mt-0.5">
              <TallyChips t={n.announced ?? (n.level === "pu" ? n.expected : null)} gap={red || n.level === "pu" ? n.gap : null} />
            </div>
          </div>
          <Pill status={n.status} />
        </div>
        {has && isOpen && (
          <div className="mt-1 space-y-1">
            {n.children.map((c) => renderRow(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div className="space-y-1">{renderRow(root, 0)}</div>;
}

export function NodeDetail({ node, path }: { node: TreeNode; path: TreeNode[] }) {
  const rows = PARTIES.map((p) => ({
    p,
    ann: node.announced?.[p] ?? null,
    proof: node.expected?.[p] ?? null,
    gap: node.gap?.[p] ?? 0,
  }));
  return (
    <div className="eri-in rounded-xl border border-white/10 bg-[#121821] p-4">
      <div className="mb-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
        {path.map((n, i) => (
          <span key={n.id}>
            {i > 0 && <span className="mx-1">→</span>}
            {n.label.split(" · ")[0]}
          </span>
        ))}
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">{node.label}</h3>
        <Pill status={node.status} />
      </div>
      <p className={`mt-1 text-sm ${node.status === "flagged" ? "text-red-300" : "text-slate-400"}`}>{node.reason}</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="py-1 font-medium">Party</th>
            <th className="py-1 text-right font-medium">{node.level === "pu" ? "Read at ward" : "Announced"}</th>
            <th className="py-1 text-right font-medium">{node.level === "pu" ? "EC8A (witnesses)" : "Proof below"}</th>
            <th className="py-1 text-right font-medium">Gap</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {rows.map((r) => (
            <tr key={r.p} className="border-t border-white/5">
              <td className="py-1.5 text-slate-300">{r.p}</td>
              <td className="py-1.5 text-right">{r.ann === null ? "—" : fmt(r.ann)}</td>
              <td className="py-1.5 text-right">{r.proof === null ? "—" : fmt(r.proof)}</td>
              <td className={`py-1.5 text-right ${r.gap ? "font-semibold text-red-300" : "text-slate-500"}`}>{r.gap ? `${r.gap > 0 ? "+" : ""}${fmt(r.gap)}` : "0"}</td>
            </tr>
          ))}
          <tr className="border-t border-white/10 text-slate-400">
            <td className="py-1.5">Total</td>
            <td className="py-1.5 text-right">{node.announced ? fmt(tallyTotal(node.announced)) : "—"}</td>
            <td className="py-1.5 text-right">{node.expected ? fmt(tallyTotal(node.expected)) : "—"}</td>
            <td className="py-1.5 text-right">{node.gap ? fmt(tallyTotal(node.gap)) : "—"}</td>
          </tr>
        </tbody>
      </table>
      {node.level === "pu" && node.sources && (
        <p className="mt-3 text-xs text-slate-500">
          Witness channels: {node.sources.sms} SMS · {node.sources.whatsapp} WhatsApp · {node.sources.photo} photo
          {node.disagreeing ? ` · ${node.disagreeing} disagree` : ""}
        </p>
      )}
      {(node.level === "pu" || node.level === "ward") && (
        <a
          href={`/api/tribunal?${node.level === "pu" ? "pu" : "ward"}=${node.code}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
        >
          ⬇ Tribunal evidence pack (PDF)
        </a>
      )}
      {node.level !== "pu" && (
        <p className="mt-3 text-xs text-slate-500">
          Traces down to {node.coverage.witnessed} of {node.coverage.total} polling-unit EC8A results witnessed by citizens.
          {node.level === "ward" && node.unwitnessedCapacity ? ` Unwitnessed PUs could account for at most ${fmt(node.unwitnessedCapacity)} votes.` : ""}
        </p>
      )}
    </div>
  );
}
