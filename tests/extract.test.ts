import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRules } from "../src/lib/extract";

test("a ward total read aloud becomes a ward entry", () => {
  const { entries, ctx } = extractRules(
    "Ward four. Party A three thousand one hundred and twenty. Party B one thousand two hundred.",
  );
  assert.deepEqual(entries, [{ level: "ward", ward: 4, tally: { A: 3120, B: 1200 } }]);
  assert.equal(ctx.ward, 4);
});

test("a polling-unit line uses the ward context and digit-by-digit ids", () => {
  const { entries } = extractRules("Polling unit zero three four. Party A 120. Party B 85. Party C 40.", { ward: 4 });
  assert.deepEqual(entries, [{ level: "pu_at_ward", pu: "034", ward: 4, tally: { A: 120, B: 85, C: 40 } }]);
});

test("a dropped polling unit is reported as dropped", () => {
  const { entries } = extractRules("Polling unit zero one two dropped.", { ward: 4 });
  assert.deepEqual(entries, [{ level: "pu_at_ward", pu: "012", ward: 4, dropped: true }]);
});

test("small talk with no figures yields nothing", () => {
  assert.deepEqual(extractRules("Good afternoon, please keep order.").entries, []);
});

test("party acronyms are understood, written or spelled out", () => {
  const written = extractRules("Ward four total. APC three thousand one hundred and twenty. LP one thousand two hundred and eighty. NNPP 696. PDP 216.");
  assert.deepEqual(written.entries[0].tally, { A: 3120, B: 1280, C: 696, D: 216 });
  const spelled = extractRules("Polling unit zero three four. A P C 175. L P 129. N N P P 81. P D P 31.", { ward: 4 });
  assert.deepEqual(spelled.entries[0].tally, { A: 175, B: 129, C: 81, D: 31 });
});
