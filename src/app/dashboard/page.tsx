"use client";
import { wit } from "@/lib/plural";
import { useMemo, useState } from "react";
import { NodeDetail, TreeView } from "@/components/TreeView";
import { usePoll } from "@/lib/client";
import type { TreeNode } from "@/lib/reconcile";
import { walk } from "@/lib/walk";

interface AlertRow {
  id: number;
  kind: string;
  level: string;
  message: string;
  created_at: string;
  ward: number | null;
  pu: string | null;
  notified: string;
}

const KIND_LABEL: Record<string, string> = {
  pu_changed: "PU changed",
  pu_dropped: "PU dropped",
  ward_inflated: "Ward total unexplained",
  lga_mismatch: "LGA ≠ sum of wards",
};

export default function Dashboard() {
  const { data: tree } = usePoll<TreeNode>("/api/tree", 1200);
  const { data: alerts } = usePoll<AlertRow[]>("/api/alerts", 1200);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const index = useMemo(() => {
    const m = new Map<string, { node: TreeNode; path: TreeNode[] }>();
    if (tree) {
      const stack: TreeNode[] = [];
      const visit = (n: TreeNode) => {
        stack.push(n);
        m.set(n.id, { node: n, path: [...stack] });
        n.children.forEach(visit);
        stack.pop();
      };
      visit(tree);
    }
    return m;
  }, [tree]);

  const stats = useMemo(() => {
    const s = { pus: 0, witnessed: 0, flagged: 0, verified: 0 };
    if (tree) {
      walk(tree, (n) => {
        if (n.level === "pu") {
          s.pus++;
          if (n.coverage.witnessed) s.witnessed++;
        }
        if (n.status === "flagged") s.flagged++;
        if (n.status === "verified" && n.level !== "pu") s.verified++;
      });
    }
    return s;
  }, [tree]);

  const selected = (selectedId && index.get(selectedId)) || (tree ? index.get(tree.children[0]?.id ?? tree.id) : null);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <section className="mb-8">
        <p className="text-sm uppercase tracking-widest text-sky-300">Every Vote, Every Voice</p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-4xl">Proof Tree</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Every hop between the polling-unit result (EC8A) and the final declaration (EC8E) — ward (EC8B), LGA (EC8C), state (EC8D). Click any figure to trace it
          down to the polling-unit results and the witnesses behind it.
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Polling units" value={stats.pus} />
        <Stat label="Polling units witnessed" value={`${stats.witnessed}/${stats.pus}`} />
        <Stat label="Hops traced" value={stats.verified} tone="ok" />
        <Stat label="Hops flagged" value={stats.flagged} tone={stats.flagged ? "bad" : "dim"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <section className="rounded-xl border border-white/10 bg-[#0f141b] p-4 max-h-[70vh] min-h-48 overflow-auto lg:h-[600px] lg:max-h-none">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Proof Tree</h2>
            <span className="hidden text-xs text-slate-500 sm:inline">state → LGA → ward → polling unit → witness photos</span>
          </div>
          {tree ? (
            <TreeView root={tree} selectedId={selected?.node.id ?? null} onSelect={(n) => setSelectedId(n.id)} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">Loading the tree…</p>
          )}
        </section>

       <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
  {selected && <NodeDetail node={selected.node} path={selected.path} />}

  <section className="rounded-xl border border-white/10 bg-[#121821] p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        Witness alarms
      </h2>
      <span className="text-xs text-slate-500">
        {alerts?.length ?? 0} raised
      </span>
    </div>

    {!alerts?.length && (
      <p className="text-sm text-slate-500">
        All quiet. Play a collation clip on the Live Ear page.
      </p>
    )}

    <ul className="space-y-2">
      {alerts?.map((a) => (
        <li
          key={a.id}
          className="eri-in rounded-lg border border-red-500/30 bg-red-500/10 p-3"
        >
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-red-300">
            <span>{KIND_LABEL[a.kind] ?? a.kind}</span>
            <span>{wit(Number(a.notified))} alerted</span>
          </div>

          <p className="mt-1 text-sm text-slate-200">{a.message}</p>
        </li>
      ))}
    </ul>
  </section>
</aside>
      </div>
    </main>
  );
}

function Stat({ label, value, tone = "dim" }: { label: string; value: number | string; tone?: "ok" | "bad" | "dim" }) {
  const color = tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : "text-white";
  return (
    <div className="rounded-xl border border-white/10 bg-[#121821] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
