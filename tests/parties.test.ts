import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARTIES, PARTIES, currentParties, emptyTally, nextPartyKey, partyFrom, partyList, setParties, tallyEq, tallyText } from "../src/lib/config";
import { extractRules } from "../src/lib/extract";
import { encodeResultSms, parseResultSms } from "../src/lib/sms-codec";

const withNdc = [...DEFAULT_PARTIES, { key: "E", acronym: "NDC", name: "A fifth party" }];
afterEach(() => setParties(DEFAULT_PARTIES));

test("the default list is APC, LP, NNPP, PDP", () => {
  assert.deepEqual(PARTIES, ["A", "B", "C", "D"]);
  assert.equal(partyList(), "APC, LP, NNPP and PDP");
});

test("a party added by an admin flows into every formatter", () => {
  setParties(withNdc);
  assert.deepEqual(PARTIES, ["A", "B", "C", "D", "E"]);
  assert.equal(partyFrom("ndc"), "E");
  assert.equal(partyFrom("e"), "E");
  assert.equal(tallyText({ A: 1, E: 9 }), "APC 1 · NDC 9");
  assert.deepEqual(emptyTally(), { A: 0, B: 0, C: 0, D: 0, E: 0 });
  assert.equal(partyList(), "APC, LP, NNPP, PDP and NDC");
});

test("older figures without the new party count it as zero", () => {
  setParties(withNdc);
  assert.ok(tallyEq({ A: 5, B: 4, C: 3, D: 2 }, { A: 5, B: 4, C: 3, D: 2, E: 0 }));
  assert.ok(!tallyEq({ A: 5, B: 4, C: 3, D: 2 }, { A: 5, B: 4, C: 3, D: 2, E: 7 }));
});

test("SMS round-trips with a fifth party, by letter or acronym", () => {
  setParties(withNdc);
  const sms = encodeResultSms("012", { A: 10, E: 55 });
  const parsed = parseResultSms(sms);
  assert.ok(parsed.ok);
  if (parsed.ok) assert.deepEqual(parsed.tally, { A: 10, E: 55 });
  assert.ok(parseResultSms(sms.replace("E55", "NDC55")).ok, "the checksum covers the figures, so the acronym spelling still verifies");
});

test("Live Ear understands a spoken new party", () => {
  setParties(withNdc);
  const { entries } = extractRules("Ward two total. APC one thousand. NDC five hundred and twelve.");
  assert.equal(entries[0].tally?.A, 1000);
  assert.equal(entries[0].tally?.E, 512);
  const spelled = extractRules("Ward two total. N D C 300.");
  assert.equal(spelled.entries[0].tally?.E, 300);
});

test("a removed party stops being recognised", () => {
  setParties(DEFAULT_PARTIES);
  assert.equal(partyFrom("NDC"), null);
  assert.equal(extractRules("Ward two total. NDC 300.").entries.length, 0);
});

test("next free key skips used letters", () => {
  assert.equal(nextPartyKey(["A", "B", "D"]), "C");
  assert.equal(nextPartyKey(currentParties().map((p) => p.key)), "E");
  assert.equal(nextPartyKey("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")), null);
});
