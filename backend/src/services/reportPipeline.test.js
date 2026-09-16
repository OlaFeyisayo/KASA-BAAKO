import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "data", "kasabaako.db");
try {
  rmSync(testDbPath, { force: true });
  rmSync(testDbPath + "-wal", { force: true });
  rmSync(testDbPath + "-shm", { force: true });
} catch {
  // ignore
}

// Found while debugging a real "the bot doesn't process my report" complaint:
// a Khaya TTS failure (quota, network, anything) used to throw out of
// processReport() with the case already saved, so the customer got a
// generic error instead of their case number. TTS is a nice-to-have on top
// of an already-successful report, not a reason to hide it.
mock.module("./tts.js", {
  namedExports: { synthesizeSpeech: async () => { throw new Error("Khaya TTS is down"); } },
});
mock.module("./llm.js", {
  namedExports: {
    REQUIRED_FIELDS: ["incident_summary", "incident_date", "amount", "fraud_category"],
    FRAUD_CATEGORIES: ["Impersonation", "Phishing", "SIM Swap Fraud", "OTP Scam", "Unauthorized Transaction", "Mobile Money Fraud", "Other"],
    buildCase: async () => ({
      case: {
        incident_summary: "Someone took money from my account",
        incident_date: "2026-09-16",
        amount: 500,
        fraud_category: "Other",
        suspected_number: null,
        transaction_id: null,
      },
      missing_fields: [],
      follow_up_questions: {},
    }),
  },
});

const { processReport } = await import("./reportPipeline.js");

test("processReport still returns the completed case when TTS confirmation fails", async () => {
  const result = await processReport({
    text: "Someone took money from my account, 500 cedis, on Sept 16",
    customer_contact: "0244000999",
    channel: "whatsapp",
    input_mode: "text",
  });

  assert.ok(result.case_id);
  assert.equal(result.missing_fields.length, 0);
  assert.equal(result.confirmationAudio, null); // no audio, but no crash either
});
