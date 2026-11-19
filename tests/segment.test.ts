import { test } from "node:test";
import assert from "node:assert/strict";
import { SegmentBuffer, segment } from "../src/lib/segment";
import { extractRules } from "../src/lib/extract";

test("segment splits on each new announcement", () => {
  assert.deepEqual(segment("Ward four. Party A 120. Polling unit 012. Party A 10."), [
    "Ward four. Party A 120.",
    "Polling unit 012. Party A 10.",
  ]);
});

test("phrases are buffered until the next announcement starts", () => {
  const b = new SegmentBuffer();
  assert.deepEqual(b.push("Ward four."), []);
  assert.deepEqual(b.push("Party A 3,120."), []);
  assert.deepEqual(b.push("Party B 400."), []);
  // A new announcement begins: the finished one is released whole, the new one stays buffered.
  assert.deepEqual(b.push("Ward five."), ["Ward four. Party A 3,120. Party B 400."]);
  assert.equal(b.pending, "Ward five.");
});

test("flush releases the pending announcement (silence or stop)", () => {
  const b = new SegmentBuffer();
  b.push("Ward four.");
  b.push("Party A 3,120.");
  assert.deepEqual(b.flush(), ["Ward four. Party A 3,120."]);
  assert.deepEqual(b.flush(), []);
});

test("a buffered live announcement reaches the extractor as one complete entry", () => {
  const b = new SegmentBuffer();
  b.push("Ward 4");
  b.push("party A 3,120");
  b.push("party B 400");
  const [seg] = b.flush();
  const { entries } = extractRules(seg);
  assert.deepEqual(entries, [{ level: "ward", ward: 4, tally: { A: 3120, B: 400 } }]);
});
