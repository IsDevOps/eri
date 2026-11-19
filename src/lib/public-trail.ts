import type { Tally } from "./config";
import type { Status, TreeNode } from "./reconcile";

/**
 * Public, read-only view of the collation trail.
 *
 * What it shows: for each hop (ward, LGA, state) the figure that was announced, what that figure was checked
 * against, and whether it traces to the polling-unit results (Form EC8A) witnessed so far.
 * What it deliberately does NOT do: rank parties, label anyone as leading or winning, or extrapolate from partial
 * witness coverage. Only INEC declares results. Polling-unit rows, phone numbers and photos are never included.
 */
export const TRAIL_DISCLAIMER =
  "Unofficial. This page shows what was announced at each collation hop and whether it traces to polling-unit results " +
  "(Form EC8A) that citizens witnessed. It is not a result and does not predict one. INEC declares the official result.";

export interface TrailRow {
  id: string;
  level: "state" | "lga" | "ward";
  depth: number;
  label: string;
  announced: Tally | null;
  /** Ward (EC8B): sum of witnessed polling-unit EC8A results. LGA / state: sum of the announced hops directly below. */
  checkedAgainst: Tally | null;
  gap: Tally | null;
  status: Status;
  headline: string;
  reason: string;
  coverage: { witnessed: number; total: number };
  flaggedBelow: number;
}

export interface PublicTrail {
  disclaimer: string;
  updatedAt: string;
  summary: {
    announcedHops: number;
    tracedHops: number;
    flaggedHops: number;
    pollingUnits: { witnessed: number; total: number };
  };
  rows: TrailRow[];
}

const HEADLINE: Record<Status, string> = {
  verified: "Matches the witnessed EC8A results",
  flagged: "Does not trace to the witnessed EC8A results",
  contested: "Witnesses disagree",
  unverified: "Not enough witnesses to confirm",
  pending: "Not announced yet",
};

export function toPublicTrail(root: TreeNode, now: Date = new Date()): PublicTrail {
  const rows: TrailRow[] = [];
  const visit = (n: TreeNode, depth: number) => {
    if (n.level === "pu") return; // polling-unit detail stays behind the per-PU check
    rows.push({
      id: n.id,
      level: n.level,
      depth,
      label: n.label,
      announced: n.announced,
      checkedAgainst: n.expected,
      gap: n.gap,
      status: n.status,
      headline: HEADLINE[n.status],
      reason: n.reason,
      coverage: n.coverage,
      flaggedBelow: n.flaggedBelow,
    });
    n.children.forEach((c) => visit(c, depth + 1));
  };
  visit(root, 0);

  const announced = rows.filter((r) => r.announced);
  return {
    disclaimer: TRAIL_DISCLAIMER,
    updatedAt: now.toISOString(),
    summary: {
      announcedHops: announced.length,
      tracedHops: announced.filter((r) => r.status === "verified").length,
      flaggedHops: rows.filter((r) => r.status === "flagged").length,
      pollingUnits: root.coverage,
    },
    rows,
  };
}
