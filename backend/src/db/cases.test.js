import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Use a throwaway DB file for tests so we never touch real data.
const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "data", "kasabaako.db");
try {
  rmSync(testDbPath, { force: true });
  rmSync(testDbPath + "-wal", { force: true });
  rmSync(testDbPath + "-shm", { force: true });
} catch {
  // ignore
}

const { createCase, mergeCaseFields, updateCaseFields, getCaseForCustomer, updateCaseStatus, getAllCases } = await import("./cases.js");

const EMPTY = {
  incident_summary: null,
  incident_date: null,
  amount: null,
  fraud_category: null,
  suspected_number: null,
  transaction_id: null,
};

test("createCase stores an incomplete case and generates a non-sequential case_id", () => {
  const merged = mergeCaseFields(EMPTY, { incident_summary: "Someone called pretending to be MTN.", incident_date: null, amount: null, fraud_category: null, suspected_number: null, transaction_id: null });
  const created = createCase({
    customer_contact: "0244123456",
    channel: "whatsapp",
    input_mode: "text",
    caseFields: merged.fields,
    missing_fields: merged.missing_fields,
  });

  assert.match(created.case_id, /^KB-[0-9A-F]{8}$/);
  assert.equal(created.status, "received");
  assert.deepEqual(created.missing_fields, ["incident_date", "amount", "fraud_category"]);
});

test("mergeCaseFields fills in missing fields without overwriting known ones", () => {
  const existing = { ...EMPTY, incident_summary: "Fake prize call", amount: 500 };
  const merged = mergeCaseFields(existing, { incident_summary: "different text", amount: 999, incident_date: "2026-09-01", fraud_category: "Impersonation", suspected_number: "0501234567", transaction_id: null });

  assert.equal(merged.fields.incident_summary, "Fake prize call"); // not overwritten
  assert.equal(merged.fields.amount, 500); // not overwritten
  assert.equal(merged.fields.incident_date, "2026-09-01"); // filled in
  assert.deepEqual(merged.missing_fields, []);
});

test("updateCaseFields completes a case and it's retrievable by the right customer", () => {
  const merged1 = mergeCaseFields(EMPTY, { ...EMPTY, incident_summary: "Wrong transfer" });
  const created = createCase({
    customer_contact: "0244000111",
    channel: "ussd",
    input_mode: "guided",
    caseFields: merged1.fields,
    missing_fields: merged1.missing_fields,
  });

  const merged2 = mergeCaseFields(created, { incident_date: "2026-09-05", amount: 200, fraud_category: "Mobile Money Fraud", suspected_number: "0209990011", transaction_id: null });
  const updated = updateCaseFields(created.case_id, merged2.fields, merged2.missing_fields);

  assert.deepEqual(updated.missing_fields, []);
  assert.equal(updated.amount, 200);
});

test("getCaseForCustomer refuses to return a case to the wrong phone number", () => {
  const merged = mergeCaseFields(EMPTY, { ...EMPTY, incident_summary: "test" });
  const created = createCase({
    customer_contact: "0277334455",
    channel: "whatsapp",
    input_mode: "voice",
    caseFields: merged.fields,
    missing_fields: merged.missing_fields,
  });

  assert.notEqual(getCaseForCustomer(created.case_id, "0277334455"), null); // matching phone -> found
  assert.notEqual(getCaseForCustomer(created.case_id, "+233277334455"), null); // normalized formats also match
  assert.equal(getCaseForCustomer(created.case_id, "0000000000"), null); // wrong phone -> refused
  assert.equal(getCaseForCustomer("KB-DOESNOTEXIST", "0277334455"), null); // unknown case -> refused
});

test("updateCaseStatus only accepts valid statuses", () => {
  const merged = mergeCaseFields(EMPTY, { ...EMPTY, incident_summary: "test" });
  const created = createCase({
    customer_contact: "0201112233",
    channel: "whatsapp",
    input_mode: "text",
    caseFields: merged.fields,
    missing_fields: merged.missing_fields,
  });

  const updated = updateCaseStatus(created.case_id, "under_review");
  assert.equal(updated.status, "under_review");
  assert.throws(() => updateCaseStatus(created.case_id, "not_a_real_status"));
});

test("getAllCases returns every stored case", () => {
  const before = getAllCases().length;
  const merged = mergeCaseFields(EMPTY, { ...EMPTY, incident_summary: "another one" });
  createCase({
    customer_contact: "0244999888",
    channel: "ussd",
    input_mode: "guided",
    caseFields: merged.fields,
    missing_fields: merged.missing_fields,
  });
  assert.equal(getAllCases().length, before + 1);
});
