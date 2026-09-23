import { test } from "node:test";
import assert from "node:assert/strict";
import { generateCaseId } from "./caseId.js";

test("generateCaseId makes KB- plus 12 digits only, so it can always be read aloud", () => {
  for (let i = 0; i < 200; i++) {
    assert.match(generateCaseId(), /^KB-\d{12}$/);
  }
});

test("generated case ids still satisfy the WhatsApp case-number lookup pattern", () => {
  assert.match(generateCaseId(), /^KB-[0-9A-F]{12}$/i);
});

test("generateCaseId doesn't repeat across a large sample", () => {
  const ids = new Set(Array.from({ length: 5000 }, generateCaseId));
  assert.equal(ids.size, 5000);
});
