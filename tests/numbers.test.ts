import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenId, wordsToNumber } from "../src/lib/numbers";

test("spoken English numbers", () => {
  assert.equal(wordsToNumber("three thousand one hundred and twenty".split(" ")), 3120);
  assert.equal(wordsToNumber("one thousand eight hundred and eighty".split(" ")), 1880);
  assert.equal(wordsToNumber(["forty"]), 40);
  assert.equal(wordsToNumber("two million".split(" ")), 2_000_000);
});

test("digits pass through and non-numbers give null", () => {
  assert.equal(wordsToNumber(["120"]), 120);
  assert.equal(wordsToNumber(["hello"]), null);
  assert.equal(wordsToNumber([]), null);
});

test("ward and PU ids are read digit by digit", () => {
  assert.equal(spokenId(["zero", "four"]), 4);
  assert.equal(spokenId(["zero", "three", "four"]), 34);
  assert.equal(spokenId(["04"]), 4);
  assert.equal(spokenId(["party"]), null);
});
