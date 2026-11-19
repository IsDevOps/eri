import { q } from "./db";
import { PARTIES, emptyTally, tallyEq, tallyKey, tallyTotal, type Tally } from "./config";

export type Level = "state" | "lga" | "ward" | "pu";
export type Status =
  | "verified" // announced figure traces to the witnessed EC8A results
  | "flagged" // announced figure cannot be traced to the witnessed EC8A results
  | "contested" // witnesses of the same PU disagree with each other
  | "unverified" // not enough witness coverage to prove or disprove
  | "pending"; // nothing announced at this hop yet

export interface Coverage {
  witnessed: number;
  total: number;
}

export interface TreeNode {
  id: string;
  level: Level;
  refId: number;
  label: string;
  code?: string;
  announced: Tally | null; // what was read out at this hop
  expected: Tally | null; // what the hop below proves it should be
  gap: Tally | null; // announced - expected
  witnessedSum: Tally; // sum of witnessed polling-unit EC8A results beneath this node
  coverage: Coverage;
  status: Status;
  reason: string;
  flaggedBelow: number;
  children: TreeNode[];
  // PU-only extras
  witnesses?: number;
  disagreeing?: number;
  sources?: { sms: number; photo: number; whatsapp: number };
  readAtWard?: Tally | null;
  dropped?: boolean;
  registered?: number;
  unwitnessedCapacity?: number; // registered voters in unwitnessed PUs (upper bound of unexplained votes)
}

export interface Row {
  lgas: { id: number; code: string; name: string; state: string }[];
  wards: { id: number; lga_id: number; number: number; name: string }[];
  pus: { id: number; ward_id: number; code: string; name: string; registered: number }[];
  subs: { pu_id: number; phone: string; source: "sms" | "photo" | "whatsapp"; results: Tally; created_at: Date }[];
  cols: {
    id: number;
    level: "pu_at_ward" | "ward" | "lga" | "state";
    ward_id: number | null;
    lga_id: number | null;
    pu_id: number | null;
    results: Tally | null;
    dropped: boolean;
  }[];
}

export async function loadRows(): Promise<Row> {
  const [lgas, wards, pus, subs, cols] = await Promise.all([
    q<Row["lgas"][number]>("select * from lga order by id"),
    q<Row["wards"][number]>("select * from ward order by number"),
    q<Row["pus"][number]>("select * from polling_unit order by code"),
    q<Row["subs"][number]>("select pu_id, phone, source, results, created_at from submission"),
    q<Row["cols"][number]>("select id, level, ward_id, lga_id, pu_id, results, dropped from collation_entry order by id"),
  ]);
  return { lgas, wards, pus, subs, cols };
}

const add = (a: Tally, b: Tally): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of PARTIES) out[p] = (a[p] ?? 0) + (b[p] ?? 0);
  return out;
};
const sub = (a: Tally, b: Tally): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const p of PARTIES) out[p] = (a[p] ?? 0) - (b[p] ?? 0);
  return out;
};
const nonZero = (t: Tally) => PARTIES.some((p) => (t[p] ?? 0) !== 0);

/** Consensus of witness submissions for one PU: biggest agreeing group, ties -> most recent. */
function consensus(subs: Row["subs"]) {
  if (!subs.length) return null;
  const groups = new Map<string, { tally: Tally; n: number; latest: number }>();
  for (const s of subs) {
    const k = tallyKey(s.results);
    const g = groups.get(k) ?? { tally: s.results, n: 0, latest: 0 };
    g.n += 1;
    g.latest = Math.max(g.latest, new Date(s.created_at).getTime());
    groups.set(k, g);
  }
  const best = [...groups.values()].sort((a, b) => b.n - a.n || b.latest - a.latest)[0];
  return { tally: best.tally, agree: best.n, disagree: subs.length - best.n };
}

export function buildTreeFromRows(r: Row): TreeNode {
  const lastCol = (pred: (c: Row["cols"][number]) => boolean) => {
    for (let i = r.cols.length - 1; i >= 0; i--) if (pred(r.cols[i])) return r.cols[i];
    return null;
  };

  const lgaNodes: TreeNode[] = r.lgas.map((lga) => {
    const wardNodes: TreeNode[] = r.wards
      .filter((w) => w.lga_id === lga.id)
      .map((ward) => {
        const puNodes: TreeNode[] = r.pus
          .filter((p) => p.ward_id === ward.id)
          .map((pu) => {
            const subs = r.subs.filter((s) => s.pu_id === pu.id);
            const cons = consensus(subs);
            const atWard = lastCol((c) => c.level === "pu_at_ward" && c.pu_id === pu.id);
            const dropped = !!atWard?.dropped;
            const readAtWard = atWard && !atWard.dropped ? atWard.results : null;
            let status: Status = "verified";
            let reason = "";
            if (!cons) {
              status = "unverified";
              reason = "No witness has submitted this polling unit’s EC8A yet.";
            } else if (dropped) {
              status = "flagged";
              reason = `Dropped at ward collation. ${cons.agree} witness(es) posted this result.`;
            } else if (readAtWard && !tallyEq(readAtWard, cons.tally)) {
              status = "flagged";
              reason = `Changed at ward collation: EC8A ${tallyKey(cons.tally)} → read out ${tallyKey(readAtWard)}.`;
            } else if (cons.disagree > 0) {
              status = "contested";
              reason = `${cons.disagree} witness(es) disagree with the ${cons.agree} that match.`;
            } else {
              reason = readAtWard
                ? `${cons.agree} witness(es) agree and the ward collation matches.`
                : `${cons.agree} witness(es) agree. Not yet read at ward collation.`;
            }
            const sources = { sms: 0, photo: 0, whatsapp: 0 };
            for (const s of subs) sources[s.source] += 1;
            return {
              id: `pu-${pu.id}`,
              level: "pu" as const,
              refId: pu.id,
              label: `PU ${pu.code}`,
              code: pu.code,
              announced: readAtWard ?? null,
              expected: cons?.tally ?? null,
              gap: readAtWard && cons ? sub(readAtWard, cons.tally) : null,
              witnessedSum: cons ? cons.tally : emptyTally(),
              coverage: { witnessed: cons ? 1 : 0, total: 1 },
              status,
              reason,
              flaggedBelow: 0,
              children: [],
              witnesses: cons?.agree ?? 0,
              disagreeing: cons?.disagree ?? 0,
              sources,
              readAtWard,
              dropped,
              registered: pu.registered,
            } satisfies TreeNode;
          });

        const witnessedSum = puNodes.reduce((s, n) => add(s, n.witnessedSum), emptyTally() as Tally);
        const witnessed = puNodes.filter((n) => n.coverage.witnessed).length;
        const unwitnessedCapacity = puNodes.filter((n) => !n.coverage.witnessed).reduce((s, n) => s + (n.registered ?? 0), 0);
        const ann = lastCol((c) => c.level === "ward" && c.ward_id === ward.id);
        const announced = ann?.results ?? null;
        const flaggedBelow = puNodes.filter((n) => n.status === "flagged").length;

        let status: Status = "pending";
        let reason = "Awaiting ward (EC8B) announcement.";
        let gap: Tally | null = null;
        if (announced) {
          gap = sub(announced, witnessedSum);
          const negative = PARTIES.some((p) => (gap![p] ?? 0) < 0);
          const positive = PARTIES.reduce((s, p) => s + Math.max(0, gap![p] ?? 0), 0);
          if (!nonZero(gap)) {
            status = witnessed === puNodes.length ? "verified" : "unverified";
            reason = `Ward total equals the sum of ${witnessed} witnessed polling-unit results (EC8A).`;
          } else if (negative || positive > unwitnessedCapacity) {
            status = "flagged";
            const worst = [...PARTIES].sort((a, b) => Math.abs(gap![b] ?? 0) - Math.abs(gap![a] ?? 0))[0];
            const g = gap![worst] ?? 0;
            const f = (n: number) => n.toLocaleString("en-US");
            reason = `Ward ${String(ward.number).padStart(2, "0")} announced ${worst} ${f(announced[worst] ?? 0)}. Its ${witnessed} witnessed polling units posted ${f(witnessedSum[worst] ?? 0)}. ${g > 0 ? "+" : ""}${f(g)} unexplained.`;
          } else {
            status = "unverified";
            reason = `${positive} extra votes could only come from ${puNodes.length - witnessed} unwitnessed polling unit(s).`;
          }
        } else if (witnessed) {
          reason = `Awaiting ward announcement. ${witnessed}/${puNodes.length} polling units witnessed.`;
        }
        if (status !== "flagged" && flaggedBelow > 0 && status === "verified") status = "unverified";

        return {
          id: `ward-${ward.id}`,
          level: "ward" as const,
          refId: ward.id,
          label: `Ward ${String(ward.number).padStart(2, "0")} · ${ward.name}`,
          code: String(ward.number).padStart(2, "0"),
          announced,
          expected: witnessedSum,
          gap,
          witnessedSum,
          coverage: { witnessed, total: puNodes.length },
          status,
          reason,
          flaggedBelow,
          children: puNodes,
          unwitnessedCapacity,
        } satisfies TreeNode;
      });

    const witnessedSum = wardNodes.reduce((s, n) => add(s, n.witnessedSum), emptyTally() as Tally);
    const coverage = wardNodes.reduce(
      (c, n) => ({ witnessed: c.witnessed + n.coverage.witnessed, total: c.total + n.coverage.total }),
      { witnessed: 0, total: 0 },
    );
    const ann = lastCol((c) => c.level === "lga" && c.lga_id === lga.id);
    const announced = ann?.results ?? null;
    const announcedWards = wardNodes.filter((w) => w.announced);
    const wardSum = announcedWards.reduce((s, n) => add(s, n.announced!), emptyTally() as Tally);
    let status: Status = "pending";
    let reason = "Awaiting LGA (EC8C) announcement.";
    let gap: Tally | null = null;
    if (announced) {
      gap = sub(announced, wardSum);
      if (announcedWards.length < wardNodes.length) {
        status = "unverified";
        reason = `Only ${announcedWards.length}/${wardNodes.length} ward results announced so far.`;
      } else if (nonZero(gap)) {
        status = "flagged";
        const worst = [...PARTIES].sort((a, b) => Math.abs(gap![b] ?? 0) - Math.abs(gap![a] ?? 0))[0];
        reason = `LGA announced ${worst} ${announced[worst] ?? 0} but its wards sum to ${wardSum[worst] ?? 0} (${(gap[worst] ?? 0) > 0 ? "+" : ""}${gap[worst]}).`;
      } else {
        const bad = wardNodes.filter((w) => w.status === "flagged").length;
        status = bad ? "unverified" : coverage.witnessed === coverage.total ? "verified" : "unverified";
        reason = bad
          ? "LGA equals the sum of its wards, but some ward totals do not trace to polling-unit results."
          : `LGA equals the sum of its ${wardNodes.length} wards. ${coverage.witnessed}/${coverage.total} polling units witnessed.`;
      }
    }
    const flaggedBelow = wardNodes.reduce((s, n) => s + n.flaggedBelow + (n.status === "flagged" ? 1 : 0), 0);
    return {
      id: `lga-${lga.id}`,
      level: "lga" as const,
      refId: lga.id,
      label: `${lga.name} LGA`,
      code: lga.code,
      announced,
      expected: announcedWards.length ? wardSum : null,
      gap,
      witnessedSum,
      coverage,
      status,
      reason,
      flaggedBelow,
      children: wardNodes,
    } satisfies TreeNode;
  });

  const witnessedSum = lgaNodes.reduce((s, n) => add(s, n.witnessedSum), emptyTally() as Tally);
  const coverage = lgaNodes.reduce(
    (c, n) => ({ witnessed: c.witnessed + n.coverage.witnessed, total: c.total + n.coverage.total }),
    { witnessed: 0, total: 0 },
  );
  const stateAnn = lastCol((c) => c.level === "state");
  const announced = stateAnn?.results ?? null;
  const announcedLgas = lgaNodes.filter((l) => l.announced);
  const lgaSum = announcedLgas.reduce((s, n) => add(s, n.announced!), emptyTally() as Tally);
  let status: Status = "pending";
  let reason = "Awaiting state (EC8D) announcement.";
  let gap: Tally | null = null;
  if (announced) {
    gap = sub(announced, lgaSum);
    if (announcedLgas.length < lgaNodes.length) {
      status = "unverified";
      reason = `Only ${announcedLgas.length}/${lgaNodes.length} LGA results announced.`;
    } else if (nonZero(gap)) {
      status = "flagged";
      reason = `State total differs from the sum of its LGAs by ${tallyTotal(gap)} votes.`;
    } else {
      status = lgaNodes.every((l) => l.status === "verified") ? "verified" : "unverified";
      reason = "State equals the sum of its LGAs.";
    }
  }
  return {
    id: "state-1",
    level: "state",
    refId: 1,
    label: `${r.lgas[0]?.state ?? "State"} (synthetic)`,
    announced,
    expected: announcedLgas.length ? lgaSum : null,
    gap,
    witnessedSum,
    coverage,
    status,
    reason,
    flaggedBelow: lgaNodes.reduce((s, n) => s + n.flaggedBelow + (n.status === "flagged" ? 1 : 0), 0),
    children: lgaNodes,
  };
}

export async function buildTree(): Promise<TreeNode> {
  return buildTreeFromRows(await loadRows());
}

export { walk } from "./walk";
