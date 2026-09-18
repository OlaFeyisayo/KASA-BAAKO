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
    customer_contact: "0200000000",
    suspected_number: "0244123456",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

test("findMatchingCases matches the same number in different formats", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", suspected_number: "+233244123456" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", suspected_number: "0244123456" })];

  const matches = findMatchingCases(newCase, existing);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].case_id, "old");
});

test("findMatchingCases ignores cases outside the 30-day window", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", created_at: "2026-09-30T10:00:00Z" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", created_at: "2026-01-01T10:00:00Z" })];

  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases ignores cases with malformed dates instead of crashing", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", created_at: "not-a-date" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", created_at: "2026-09-01T10:00:00Z" })];

  assert.doesNotThrow(() => findMatchingCases(newCase, existing));
  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases excludes the case itself and non-matching numbers", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111" });
  const existing = [
    makeCase({ case_id: "new", customer_contact: "0201111111" }), // same id as newCase, should be excluded
    makeCase({ case_id: "other", customer_contact: "0203333333", suspected_number: "0500000000" }),
  ];

  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases excludes the same customer reporting the same number again", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111" });
  const existing = [
    makeCase({ case_id: "old", customer_contact: "+233201111111" }), // same person, different phone format
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

test("findMatchingCases matches the same email in different casing", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", suspected_number: null, suspected_email: "Scammer@Gmail.com" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", suspected_number: null, suspected_email: "scammer@gmail.com" })];

  const matches = findMatchingCases(newCase, existing);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].case_id, "old");
  assert.equal(matches[0].matchedOn, "email");
});

test("findMatchingCases doesn't cross-match a number against an email", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", suspected_number: null, suspected_email: "scammer@gmail.com" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", suspected_number: "0244123456", suspected_email: null })];

  assert.equal(findMatchingCases(newCase, existing).length, 0);
});

test("findMatchingCases doesn't double-count a case matching on both number and email", () => {
  const newCase = makeCase({ case_id: "new", customer_contact: "0201111111", suspected_number: "0244123456", suspected_email: "scammer@gmail.com" });
  const existing = [makeCase({ case_id: "old", customer_contact: "0202222222", suspected_number: "0244123456", suspected_email: "scammer@gmail.com" })];

  assert.equal(findMatchingCases(newCase, existing).length, 1);
});

test("buildAlertMessage includes the suspected email when matchedOn is email", () => {
  const message = buildAlertMessage(makeCase({ suspected_email: "scammer@gmail.com", matchedOn: "email" }));
  assert.match(message, /scammer@gmail\.com/);
});
