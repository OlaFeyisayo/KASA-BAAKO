import { test } from "node:test";
import assert from "node:assert/strict";
import { nextFollowUpQuestion } from "./whatsapp.js";

const REQUIRED_ORDER = ["incident_summary", "incident_date", "amount", "fraud_category"];

test("nextFollowUpQuestion asks about fields in REQUIRED_FIELDS order, not missing_fields order", () => {
  // amount listed first in missing_fields, but incident_date should still
  // be asked about first since it comes earlier in REQUIRED_FIELDS.
  const missing = ["amount", "incident_date"];
  const followUps = { amount: "How much?", incident_date: "Da bɛn?" };
  assert.equal(nextFollowUpQuestion(missing, followUps, "tw"), "Da bɛn?");
});

test("nextFollowUpQuestion returns null once nothing required is missing", () => {
  assert.equal(nextFollowUpQuestion([], {}, "tw"), null);
});

test("nextFollowUpQuestion uses the LLM's own (Twi) question for a Twi customer", () => {
  const question = nextFollowUpQuestion(["amount"], { amount: "Sika dodoɔ sɛn?" }, "tw");
  assert.equal(question, "Sika dodoɔ sɛn?");
});

test("nextFollowUpQuestion uses the English fallback for an English customer, since buildCase() only ever writes Twi", () => {
  const question = nextFollowUpQuestion(["amount"], { amount: "Sika dodoɔ sɛn?" }, "en");
  assert.match(question, /amount of money/i);
});

test("every REQUIRED_FIELDS entry has an English fallback question, so an English customer is never asked a Twi-only question", () => {
  // Defensive: FOLLOW_UP_QUESTIONS_EN has to stay in sync with
  // REQUIRED_FIELDS by hand (it's not derived from llm.js) — this catches
  // the day someone adds a required field there without updating this file.
  for (const field of REQUIRED_ORDER) {
    const question = nextFollowUpQuestion([field], {}, "en");
    assert.ok(question, `no English follow-up question defined for required field "${field}"`);
  }
});
