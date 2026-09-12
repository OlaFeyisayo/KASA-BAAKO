import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findMatchingCases,
  buildAlertMessage,
  shouldEscalateToMTN,
  buildMTNEscalationNotice,
} from "./alerts.js";

function makeCase(overrides = {}) {
  return {
    case_id: "KB-TEST",
    suspected_number: "0244123456",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

test("findMatchingCases matches the same number in different formats", () => {
  const newCase = makeCase({ case_id: "new", suspected_number: "+233244123456" });
  const existing = [makeCase({ case_id: "old", suspected_number: "0244123456" })];

  const matches = findMatchingCases(newCase, existing);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].case_id, "old");
});

test("findMatchingCases ignores cases outside the 30-day window", () => {
  const newCase = makeCase({ case_id: "new", created_at: "2026-09-30T10:00:00Z" });
  const existing = [makeCase({ case_id: "old", created_at: "2026-01-01T10:00:00Z" })];

  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases ignores cases with malformed dates instead of crashing", () => {
  const newCase = makeCase({ case_id: "new", created_at: "not-a-date" });
  const existing = [makeCase({ case_id: "old", created_at: "2026-09-01T10:00:00Z" })];

  assert.doesNotThrow(() => findMatchingCases(newCase, existing));
  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases excludes the case itself and non-matching numbers", () => {
  const newCase = makeCase({ case_id: "new" });
  const existing = [
    makeCase({ case_id: "new" }), // same id as newCase, should be excluded
    makeCase({ case_id: "other", suspected_number: "0500000000" }),
  ];

  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("shouldEscalateToMTN is false below the threshold", () => {
  const matches = [makeCase(), makeCase(), makeCase()]; // 3 + the new case = 4
  assert.equal(shouldEscalateToMTN(matches), false);
});

test("shouldEscalateToMTN is true at the threshold", () => {
  const matches = [makeCase(), makeCase(), makeCase(), makeCase()]; // 4 + the new case = 5
  assert.equal(shouldEscalateToMTN(matches), true);
});

test("buildAlertMessage includes the suspected number", () => {
  const message = buildAlertMessage(makeCase({ suspected_number: "0501234567" }));
  assert.match(message, /0501234567/);
});

test("buildMTNEscalationNotice includes the count and the number", () => {
  const newCase = makeCase({ suspected_number: "0501234567" });
  const matches = [makeCase(), makeCase(), makeCase(), makeCase()];
  const notice = buildMTNEscalationNotice(newCase, matches);
  assert.match(notice, /0501234567/);
  assert.match(notice, /5/);
});
