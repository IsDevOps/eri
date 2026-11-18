import { test } from "node:test";
import assert from "node:assert/strict";
import { safeEqual, signToken, verifyToken } from "../src/lib/auth-token";
import { hashPassword, passwordProblem, verifyPassword } from "../src/lib/password";

test("a signed token verifies and carries its role", () => {
  const p = verifyToken(signToken({ uid: 7, role: "observer" }));
  assert.equal(p?.uid, 7);
  assert.equal(p?.role, "observer");
});

test("tampered, forged and empty tokens are rejected", () => {
  const [, sig] = signToken({ uid: 7, role: "witness" }).split(".");
  const forged = Buffer.from(JSON.stringify({ uid: 7, role: "admin", exp: 9e12 })).toString("base64url");
  assert.equal(verifyToken(`${forged}.${sig}`), null);
  assert.equal(verifyToken("garbage"), null);
  assert.equal(verifyToken(undefined), null);
  assert.equal(verifyToken(""), null);
});

test("safeEqual", () => {
  assert.ok(safeEqual("abc", "abc"));
  assert.ok(!safeEqual("abc", "abd"));
  assert.ok(!safeEqual("abc", "abcd"));
});

test("passwords hash, verify and are salted", async () => {
  const a = await hashPassword("correct horse battery");
  const b = await hashPassword("correct horse battery");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("correct horse battery", a));
  assert.ok(!(await verifyPassword("wrong password", a)));
  assert.ok(!(await verifyPassword("x", null)));
});

test("password policy", () => {
  assert.ok(passwordProblem("short"));
  assert.equal(passwordProblem("long-enough-password"), null);
});
