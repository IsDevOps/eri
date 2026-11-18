import { test } from "node:test";
import assert from "node:assert/strict";
import { checksum, encodeResultSms, parseResultSms } from "../src/lib/sms-codec";

test("encode then parse round-trips a result", () => {
  const sms = encodeResultSms("012", { A: 120, B: 85, C: 40 });
  assert.match(sms, /^R 012 A120 B85 C40 #[0-9A-F]{3}$/);
  const parsed = parseResultSms(sms);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.equal(parsed.puCode, "012");
    assert.deepEqual(parsed.tally, { A: 120, B: 85, C: 40 });
  }
});

test("parser is tolerant of case and spacing", () => {
  const sms = encodeResultSms("034", { A: 5, B: 7 });
  const messy = `  ${sms.toLowerCase().replace(/ /g, "   ")}  `;
  assert.ok(parseResultSms(messy).ok);
});

test("short PU codes are zero-padded", () => {
  const good = encodeResultSms("007", { A: 1 });
  const parsed = parseResultSms(good.replace("R 007", "R 7"));
  assert.ok(parsed.ok);
  if (parsed.ok) assert.equal(parsed.puCode, "007");
});

test("a garbled figure is rejected with the corrected checksum", () => {
  const sms = encodeResultSms("012", { A: 120, B: 85, C: 40 });
  const garbled = sms.replace("A120", "A129");
  const parsed = parseResultSms(garbled);
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.reason, "checksum");
    assert.equal(parsed.puCode, "012");
    assert.equal(parsed.expected, checksum("012", { A: 129, B: 85, C: 40 }));
  }
});

test("malformed or unknown-party messages are rejected", () => {
  assert.deepEqual(parseResultSms("hello"), { ok: false, reason: "format" });
  const bad = parseResultSms("R 012 Z10 #000");
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.reason, "party");
});

test("checksum treats a missing party as zero", () => {
  assert.equal(checksum("012", { A: 1, B: 0 }), checksum("012", { A: 1 }));
});
