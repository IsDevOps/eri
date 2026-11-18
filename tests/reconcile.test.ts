import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTreeFromRows, type Row, type TreeNode } from "../src/lib/reconcile";
import { walk } from "../src/lib/walk";
import { tallyEq, type Tally } from "../src/lib/config";

/** One LGA, one ward, three PUs. PU 1 and 2 are witnessed; PU 3 (500 registered) is not. */
function fixture(over: Partial<Row> = {}): Row {
  const t = (n: number) => new Date(2026, 10, 18, 10, n);
  const sub = (pu_id: number, phone: string, results: Tally, n = 0) => ({
    pu_id, phone, source: "sms" as const, results, created_at: t(n),
  });
  return {
    lgas: [{ id: 1, code: "01", name: "Eriwa", state: "Demo State" }],
    wards: [{ id: 1, lga_id: 1, number: 4, name: "Ward Four" }],
    pus: [
      { id: 1, ward_id: 1, code: "001", name: "PU 1", registered: 400 },
      { id: 2, ward_id: 1, code: "002", name: "PU 2", registered: 400 },
      { id: 3, ward_id: 1, code: "003", name: "PU 3", registered: 500 },
    ],
    subs: [
      sub(1, "+2348000000001", { A: 100, B: 50 }),
      sub(1, "+2348000000002", { A: 100, B: 50 }),
      sub(2, "+2348000000003", { A: 80, B: 20 }),
    ],
    cols: [],
    ...over,
  };
}

const find = (root: TreeNode, id: string) => {
  let hit: TreeNode | undefined;
  walk(root, (n) => { if (n.id === id) hit = n; });
  assert.ok(hit, `node ${id} exists`);
  return hit;
};

test("PU wall is the consensus of witnesses; unwitnessed PU is unverified", () => {
  const tree = buildTreeFromRows(fixture());
  assert.ok(tallyEq(find(tree, "pu-1").wallSum, { A: 100, B: 50 }));
  assert.equal(find(tree, "pu-1").witnesses, 2);
  assert.equal(find(tree, "pu-3").status, "unverified");
  assert.equal(find(tree, "ward-1").status, "pending");
});

test("disagreeing witnesses mark the PU contested", () => {
  const rows = fixture();
  rows.subs.push({ pu_id: 2, phone: "+2348000000004", source: "photo", results: { A: 99, B: 1 }, created_at: new Date() });
  const pu2 = find(buildTreeFromRows(rows), "pu-2");
  assert.equal(pu2.status, "contested");
  assert.equal(pu2.disagreeing, 1);
});

test("ward equal to the sum of its walls, with full coverage, is verified", () => {
  const rows = fixture();
  rows.subs.push({ pu_id: 3, phone: "+2348000000005", source: "sms", results: { A: 10 }, created_at: new Date() });
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 190, B: 70 }, dropped: false });
  const ward = find(buildTreeFromRows(rows), "ward-1");
  assert.equal(ward.status, "verified");
});

test("an inflated ward total is flagged with the exact gap", () => {
  const rows = fixture();
  // walls: A 180 B 70 (PU 3 unwitnessed, 500 registered). Announce A 180+1240.
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 1420, B: 70 }, dropped: false });
  const ward = find(buildTreeFromRows(rows), "ward-1");
  assert.equal(ward.status, "flagged");
  assert.equal(ward.gap?.A, 1240);
  assert.match(ward.reason, /\+1,240 unexplained/);
});

test("a surplus that unwitnessed PUs could account for is only unverified, not flagged", () => {
  const rows = fixture();
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 280, B: 70 }, dropped: false });
  const ward = find(buildTreeFromRows(rows), "ward-1");
  assert.equal(ward.status, "unverified");
});

test("a ward total below the walls is flagged (votes were removed)", () => {
  const rows = fixture();
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 100, B: 70 }, dropped: false });
  assert.equal(find(buildTreeFromRows(rows), "ward-1").status, "flagged");
});

test("a PU line changed or dropped at ward collation is flagged", () => {
  const changed = fixture();
  changed.cols.push({ id: 1, level: "pu_at_ward", ward_id: 1, lga_id: null, pu_id: 1, results: { A: 10, B: 50 }, dropped: false });
  assert.equal(find(buildTreeFromRows(changed), "pu-1").status, "flagged");

  const dropped = fixture();
  dropped.cols.push({ id: 1, level: "pu_at_ward", ward_id: 1, lga_id: null, pu_id: 1, results: null, dropped: true });
  const pu1 = find(buildTreeFromRows(dropped), "pu-1");
  assert.equal(pu1.status, "flagged");
  assert.match(pu1.reason, /Dropped/);

  const same = fixture();
  same.cols.push({ id: 1, level: "pu_at_ward", ward_id: 1, lga_id: null, pu_id: 1, results: { A: 100, B: 50 }, dropped: false });
  assert.equal(find(buildTreeFromRows(same), "pu-1").status, "verified");
});

test("the LGA must equal the sum of its announced wards", () => {
  const ok = fixture();
  ok.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 280, B: 70 }, dropped: false });
  ok.cols.push({ id: 2, level: "lga", ward_id: null, lga_id: 1, pu_id: null, results: { A: 280, B: 70 }, dropped: false });
  assert.notEqual(find(buildTreeFromRows(ok), "lga-1").status, "flagged");

  const bad = fixture();
  bad.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 280, B: 70 }, dropped: false });
  bad.cols.push({ id: 2, level: "lga", ward_id: null, lga_id: 1, pu_id: null, results: { A: 300, B: 70 }, dropped: false });
  const lga = find(buildTreeFromRows(bad), "lga-1");
  assert.equal(lga.status, "flagged");
  assert.equal(lga.gap?.A, 20);
});

test("the latest collation entry for a hop wins", () => {
  const rows = fixture();
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 1420, B: 70 }, dropped: false });
  rows.cols.push({ id: 2, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 280, B: 70 }, dropped: false });
  assert.equal(find(buildTreeFromRows(rows), "ward-1").status, "unverified");
});

test("flagged counts bubble up to the state node", () => {
  const rows = fixture();
  rows.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 1420, B: 70 }, dropped: false });
  assert.equal(buildTreeFromRows(rows).flaggedBelow, 1);
});
