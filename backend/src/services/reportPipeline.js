// Shared report-processing pipeline: ASR (if audio) -> LLM -> DB (create or
// merge into an existing case) -> TTS confirmation -> fraud alert check.
//
// Used by both the POST /report HTTP route (server.js) and the WhatsApp bot
// (channels/whatsapp.js), so the logic only lives in one place.

import { transcribeAudio } from "./asr.js";
import { buildCase } from "./llm.js";
import { synthesizeSpeech } from "./tts.js";
import { createCase, mergeCaseFields, updateCaseFields, getCaseForCustomer, getCasesBySuspectedNumber } from "../db/cases.js";
import { findMatchingCases, buildAlertMessage, shouldEscalateToMTN, buildMTNEscalationNotice } from "./alerts.js";
import { normalizePhoneNumber } from "../utils/phone.js";

const EMPTY_CASE_FIELDS = {
  incident_summary: null,
  incident_date: null,
  amount: null,
  fraud_category: null,
  suspected_number: null,
  transaction_id: null,
};

// Per-customer lock: WhatsApp decides whether an incoming message continues
// an open case by looking one up (getOpenCaseForCustomer) *before* calling
// processReport(). If the same customer's messages arrive close together,
// both lookups can run before either message finishes being saved, so both
// see "no open case" and each creates its own — two cases for one
// conversation. Wrapping that lookup-then-process sequence in this lock
// makes the second message wait for the first to finish (and its case to
// exist) before it checks.
// Map of key -> { promise, generation }. `generation` (not the promise
// object itself) is what cleanup compares against below — comparing
// promise identity looked right but silently never matched (the map always
// held a derived `.then()` wrapper, never the exact promise being awaited),
// so under real load this map only grew and never shrank: one entry per
// customer phone number that ever messaged, forever, for the process's
// lifetime. A stress test (50,000 distinct customers) confirmed 50,000
// leaked entries. A generation counter avoids that class of bug entirely.
const locks = new Map();
let nextGeneration = 0;

/**
 * Runs `fn` exclusively per customer: calls for the same (normalized) phone
 * number queue up and run one at a time, in arrival order; different
 * customers never block each other. Cleans up its map entry once no other
 * call for that customer is queued behind it, however `fn` resolves.
 *
 * @param {string} customerContact
 * @param {() => Promise<any>} fn
 */
export async function withCustomerLock(customerContact, fn) {
  const key = normalizePhoneNumber(customerContact);
  const entry = locks.get(key);
  const prev = entry ? entry.promise : Promise.resolve();
  const generation = ++nextGeneration;

  // Wait for prev to settle either way (its outcome belongs to a different
  // caller) before running fn, so one customer's error can't jam the queue
  // for their next message.
  const current = prev.catch(() => {}).then(fn);
  locks.set(key, { promise: current.catch(() => {}), generation });

  try {
    return await current;
  } finally {
    const latest = locks.get(key);
    if (latest && latest.generation === generation) locks.delete(key);
  }
}

/** Test-only: exposes the lock map's size so tests can check for leaks. */
export function _lockMapSizeForTests() {
  return locks.size;
}

/**
 * @param {object} params
 * @param {string} [params.text] - Text report. Required if audioBuffer isn't given.
 * @param {Buffer} [params.audioBuffer] - Voice report audio. Required if text isn't given.
 * @param {string} [params.contentType] - MIME type of audioBuffer (e.g. "audio/ogg").
 * @param {string} params.customer_contact
 * @param {"whatsapp"|"ussd"} params.channel
 * @param {"voice"|"text"|"guided"} params.input_mode
 * @param {string} [params.case_id] - Pass to continue an existing (incomplete) case.
 * @param {string} [params.language="twi"]
 * @param {boolean} [params.synthesizeConfirmation=true] - Set false for text-only
 *   channels (USSD) so we don't waste a Khaya TTS call on audio nobody can play.
 * @returns {Promise<{
 *   case_id: string,
 *   case: object,
 *   missing_fields: string[],
 *   follow_up_questions: Record<string, string>,
 *   confirmationAudio: Buffer|null,
 *   alert: object|null
 * }>}
 */
export async function processReport({ text, audioBuffer, contentType, customer_contact, channel, input_mode, case_id, language, synthesizeConfirmation = true }) {
  if (!customer_contact || !channel || !input_mode) {
    throw new Error("customer_contact, channel, and input_mode are required");
  }

  let reportText = text;
  if (!reportText && audioBuffer) {
    const transcription = await transcribeAudio(audioBuffer, { contentType });
    reportText = transcription.text;
  }

  if (!reportText) {
    throw new Error("No text or audio provided");
  }

  const result = await buildCase(reportText);

  let existingCase = EMPTY_CASE_FIELDS;
  if (case_id) {
    const found = getCaseForCustomer(case_id, customer_contact);
    if (!found) {
      const err = new Error("Case not found");
      err.code = "CASE_NOT_FOUND";
      throw err;
    }
    existingCase = found;
  }

  const merged = mergeCaseFields(existingCase, result.case);

  const finalCase = case_id
    ? updateCaseFields(case_id, merged.fields, merged.missing_fields)
    : createCase({
        customer_contact,
        channel,
        input_mode,
        language: language || "twi",
        caseFields: merged.fields,
        missing_fields: merged.missing_fields,
      });

  const followUpQuestions = Object.fromEntries(
    Object.entries(result.follow_up_questions).filter(([field]) => merged.missing_fields.includes(field))
  );

  let confirmationAudio = null;
  let alertInfo = null;

  if (merged.missing_fields.length === 0) {
    if (synthesizeConfirmation) {
      confirmationAudio = await synthesizeSpeech(finalCase.incident_summary);
    }

    const candidates = getCasesBySuspectedNumber(normalizePhoneNumber(finalCase.suspected_number), finalCase.case_id);
    const matches = findMatchingCases(finalCase, candidates);
    if (matches.length > 0) {
      alertInfo = shouldEscalateToMTN(matches)
        ? { type: "mtn_escalation", notice: buildMTNEscalationNotice(finalCase, matches) }
        : { type: "individual", messages: matches.map((m) => ({ to: m.customer_contact, text: buildAlertMessage(m) })) };
    }
  }

  return {
    case_id: finalCase.case_id,
    case: finalCase,
    missing_fields: merged.missing_fields,
    follow_up_questions: followUpQuestions,
    confirmationAudio,
    alert: alertInfo,
  };
}
