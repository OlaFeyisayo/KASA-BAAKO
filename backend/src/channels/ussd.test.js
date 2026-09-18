import { test, mock } from "node:test";
import assert from "node:assert/strict";

// Captures the `text` handed to processReport so these tests can check
// what USSD actually told the AI, without touching the real DB or LLM.
let lastReportCall = null;
mock.module("../services/reportPipeline.js", {
  namedExports: {
    processReport: async (params) => {
      lastReportCall = params;
      return { case_id: "KB-TEST", missing_fields: [], alert: null };
    },
    // Unused by these tests (alert is always null above, so whatsapp.js's
    // relay path never runs) but whatsapp.js imports it, so it must exist
    // for that module to load — a plain passthrough is enough.
    withCustomerLock: async (_customerContact, fn) => fn(),
  },
});

// Imported dynamically (and only here) so this file never loads the real,
// unmocked ussd.js/reportPipeline.js before mock.module() above takes effect.
const { handleUssdRequest, parseAmount } = await import("./ussd.js");

function fakeReqRes(text) {
  const req = { body: { sessionId: "s1", phoneNumber: "+233244000000", text } };
  const res = {
    body: null,
    set() {},
    send(body) {
      this.body = body;
    },
  };
  return { req, res };
}

test("USSD asks for the suspect's email, not phone number, on a Phishing-category report", async () => {
  // Category "2" is Phishing (see FRAUD_CATEGORIES in llm.js) — step 4 should
  // ask for an email address instead of the usual phone number.
  const { req, res } = fakeReqRes("2*2*500*today");
  await handleUssdRequest(req, res);
  assert.match(res.body, /email/i);
  assert.doesNotMatch(res.body, /phone number/i);
});

test("USSD still asks for a phone number on a non-Phishing report", async () => {
  const { req, res } = fakeReqRes("2*1*500*today");
  await handleUssdRequest(req, res);
  assert.match(res.body, /phone number/i);
});

test("a Phishing report's email answer is sent to the AI as 'Suspected email', not 'Suspected number'", async () => {
  const { req, res } = fakeReqRes("2*2*500*today*scammer@example.com*They emailed me a fake MTN link");
  await handleUssdRequest(req, res);
  assert.match(lastReportCall.text, /Suspected email: scammer@example\.com\./);
  assert.doesNotMatch(lastReportCall.text, /Suspected number/);
});

test("a non-Phishing report's answer is still sent as 'Suspected number'", async () => {
  const { req, res } = fakeReqRes("2*1*500*today*0244000111*Someone called pretending to be MTN");
  await handleUssdRequest(req, res);
  assert.match(lastReportCall.text, /Suspected number: 0244000111\./);
  assert.doesNotMatch(lastReportCall.text, /Suspected email/);
});

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
