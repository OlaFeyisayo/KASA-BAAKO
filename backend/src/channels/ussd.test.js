import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount } from "./ussd.js";

test("parseAmount accepts a plain number", () => {
  assert.equal(parseAmount("500"), 500);
});

test("parseAmount accepts a decimal", () => {
  assert.equal(parseAmount("500.50"), 500.5);
});

test("parseAmount tolerates currency text around the number", () => {
  assert.equal(parseAmount("GHS 500"), 500);
});

test("parseAmount accepts 0 (customer doesn't know the amount)", () => {
  assert.equal(parseAmount("0"), 0);
});

test("parseAmount rejects a negative amount instead of silently dropping the sign", () => {
  // Found via manual load/QA testing: the old implementation stripped every
  // non-digit character (including "-") before parsing, so "-500" silently
  // became the valid amount 500 instead of being rejected.
  assert.equal(parseAmount("-500"), null);
  assert.equal(parseAmount("-0.01"), null);
});

test("parseAmount rejects non-numeric input", () => {
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("   "), null);
});
