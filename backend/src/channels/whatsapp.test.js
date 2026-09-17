import { test } from "node:test";
import assert from "node:assert/strict";
import { nextFollowUpQuestion, sendWhatsAppText, sendWhatsAppButtons, sendWhatsAppAudio, isDuplicateMessage } from "./whatsapp.js";

// Found in production: a "restart" fired with no message from the
// customer, ~13 minutes after they'd already received a case number.
// Meta retries a webhook delivery that never got a 200 response back in
// time (e.g. during the server crash fixed separately) — the retry
// resends the EXACT same message, which without this looked like a
// brand new incoming command and got reprocessed. A message id must
// only ever be actionable once.
test("isDuplicateMessage lets a genuinely new message id through", () => {
  assert.equal(isDuplicateMessage("wamid.UNIQUE_TEST_ID_1"), false);
});

test("isDuplicateMessage flags the same message id as a duplicate the second time", () => {
  const id = "wamid.UNIQUE_TEST_ID_2";
  assert.equal(isDuplicateMessage(id), false, "first time should not be a duplicate");
  assert.equal(isDuplicateMessage(id), true, "second time (a Meta retry replaying the same message) must be flagged");
  assert.equal(isDuplicateMessage(id), true, "a third replay must also still be flagged, not just the first retry");
});

test("isDuplicateMessage treats different message ids as independent", () => {
  assert.equal(isDuplicateMessage("wamid.UNIQUE_TEST_ID_3"), false);
  assert.equal(isDuplicateMessage("wamid.UNIQUE_TEST_ID_4"), false);
});

// Found in production: a transient network failure reaching Meta's API
// (a connection timeout, not Meta responding with an error) went
// uncaught inside these functions, which crashed the entire process —
// Node treats an unhandled promise rejection as fatal by default. Since
// these are frequently called from error-handling code itself (reporting
// an EARLIER failure back to the customer), one network blip could crash
// the whole backend, not just fail to deliver one message. They must
// never throw, no matter how `fetch` fails.
test("sendWhatsAppText never throws, even when fetch rejects with a network error", async (t) => {
  t.mock.method(global, "fetch", async () => {
    throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  });
  await assert.doesNotReject(() => sendWhatsAppText("233000000000", "hello"));
});

test("sendWhatsAppButtons never throws, even when fetch rejects with a network error", async (t) => {
  t.mock.method(global, "fetch", async () => {
    throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  });
  await assert.doesNotReject(() => sendWhatsAppButtons("233000000000", "hello", [{ id: "x", title: "X" }]));
});

test("sendWhatsAppAudio never throws, even when fetch rejects with a network error", async (t) => {
  t.mock.method(global, "fetch", async () => {
    throw new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  });
  await assert.doesNotReject(() => sendWhatsAppAudio("233000000000", Buffer.from("fake audio")));
});

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
