import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { buildCase } from "./llm.js";

function fakeAnthropicResponse(text) {
  return {
    ok: true,
    json: async () => ({ content: [{ type: "text", text }] }),
  };
}

test("buildCase degrades to 'nothing extracted' instead of throwing when Claude doesn't return valid JSON", async (t) => {
  // The exact failure mode hit in production: Claude replied with prose
  // instead of the required JSON shape (previously threw and failed the
  // whole report with a generic "something went wrong" error).
  t.mock.method(global, "fetch", async () => fakeAnthropicResponse("Sorry, I need more information to help with that."));

  const result = await buildCase("Someone impersonated my dad and demanded 4000 cedis, 15th September 2026");

  assert.deepEqual(result.missing_fields, ["incident_summary", "incident_date", "amount", "fraud_category"]);
  assert.equal(result.case.incident_summary, null);
});

test("buildCase logs Claude's actual raw response when it fails to parse, for debuggability", async (t) => {
  t.mock.method(global, "fetch", async () => fakeAnthropicResponse("I cannot determine the fraud category from this."));
  const errorLog = t.mock.method(console, "error");

  await buildCase("some report text");

  const loggedRaw = errorLog.mock.calls.some((call) =>
    call.arguments.some((arg) => typeof arg === "string" && arg.includes("I cannot determine"))
  );
  assert.ok(loggedRaw, "expected the raw Claude response to be logged somewhere in the console.error calls");
});

test("buildCase still parses normally when Claude returns valid JSON", async (t) => {
  const validJson = JSON.stringify({
    case: {
      incident_summary: "Someone called pretending to be MTN",
      incident_date: "2026-09-15",
      amount: 4000,
      fraud_category: "Impersonation",
      suspected_number: null,
      transaction_id: null,
    },
    missing_fields: [],
    follow_up_questions: {},
  });
  t.mock.method(global, "fetch", async () => fakeAnthropicResponse(validJson));

  const result = await buildCase("Someone impersonated my dad and demanded 4000 cedis");

  assert.equal(result.case.amount, 4000);
  assert.equal(result.case.fraud_category, "Impersonation");
  assert.deepEqual(result.missing_fields, []);
});

test("buildCase joins multiple text blocks instead of only reading the first one", async (t) => {
  const validJson = JSON.stringify({
    case: { incident_summary: "test", incident_date: "2026-09-15", amount: 100, fraud_category: "Other", suspected_number: null, transaction_id: null },
    missing_fields: [],
    follow_up_questions: {},
  });
  // Split right after a comma — valid JSON allows whitespace there, so
  // rejoining with "\n" (as buildCase does) still parses correctly. This
  // is what actually matters: two blocks are read and combined, not
  // dropped — not that any arbitrary mid-token split survives rejoining.
  const splitAt = validJson.indexOf(",") + 1;
  t.mock.method(global, "fetch", async () => ({
    ok: true,
    json: async () => ({
      content: [
        { type: "text", text: validJson.slice(0, splitAt) },
        { type: "text", text: validJson.slice(splitAt) },
      ],
    }),
  }));

  const result = await buildCase("some text");
  assert.equal(result.case.amount, 100);
});
