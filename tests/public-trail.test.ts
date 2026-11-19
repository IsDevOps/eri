import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTreeFromRows, type Row } from "../src/lib/reconcile";
import { TRAIL_DISCLAIMER, toPublicTrail } from "../src/lib/public-trail";

function rows(over: Partial<Row> = {}): Row {
  return {
    lgas: [{ id: 1, code: "01", name: "Eriwa", state: "Demo State" }],
    wards: [{ id: 1, lga_id: 1, number: 4, name: "Ward Four" }],
    pus: [
      { id: 1, ward_id: 1, code: "001", name: "PU 1", registered: 400 },
      { id: 2, ward_id: 1, code: "002", name: "PU 2", registered: 500 },
    ],
    subs: [
      { pu_id: 1, phone: "+2348000000001", source: "sms", results: { A: 100, B: 50 }, created_at: new Date() },
      { pu_id: 1, phone: "+2348000000002", source: "photo", results: { A: 100, B: 50 }, created_at: new Date() },
    ],
    cols: [],
    ...over,
  };
}

test("the trail lists state, LGA and ward hops only, never polling units", () => {
  const trail = toPublicTrail(buildTreeFromRows(rows()));
  assert.deepEqual(trail.rows.map((r) => r.level), ["state", "lga", "ward"]);
  assert.deepEqual(trail.rows.map((r) => r.depth), [0, 1, 2]);
});

test("nothing identifying leaks: no phones, sources, or per-witness counts", () => {
  const raw = JSON.stringify(toPublicTrail(buildTreeFromRows(rows())));
  assert.ok(!raw.includes("+234"));
  assert.ok(!/phone|witnesses|sources|disagreeing/i.test(raw));
});

test("it never ranks parties or names a leader", () => {
  const r = rows();
  r.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 150, B: 50 }, dropped: false });
  const raw = JSON.stringify(toPublicTrail(buildTreeFromRows(r)));
  assert.ok(!/winner|winning|leading|leader|ahead|lead\b/i.test(raw));
});

test("the unofficial disclaimer is always attached", () => {
  const trail = toPublicTrail(buildTreeFromRows(rows()));
  assert.equal(trail.disclaimer, TRAIL_DISCLAIMER);
  assert.match(trail.disclaimer, /INEC declares the official result/);
});

test("an inflated ward is reported as not tracing, and counted", () => {
  const r = rows();
  r.cols.push({ id: 1, level: "ward", ward_id: 1, lga_id: null, pu_id: null, results: { A: 1400, B: 50 }, dropped: false });
  const trail = toPublicTrail(buildTreeFromRows(r));
  const ward = trail.rows.find((x) => x.level === "ward");
  assert.equal(ward?.status, "flagged");
  assert.equal(ward?.headline, "Does not trace to the witnessed walls");
  assert.equal(trail.summary.flaggedHops, 1);
  assert.equal(trail.summary.announcedHops, 1);
  assert.equal(trail.summary.tracedHops, 0);
});

test("before any announcement every hop says it is not announced yet", () => {
  const trail = toPublicTrail(buildTreeFromRows(rows()));
  assert.ok(trail.rows.every((x) => x.headline === "Not announced yet"));
  assert.equal(trail.summary.announcedHops, 0);
  assert.deepEqual(trail.summary.walls, { witnessed: 1, total: 2 });
});
