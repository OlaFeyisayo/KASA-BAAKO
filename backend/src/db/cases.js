// Step 5: create/get/update-status functions for the "cases" table (schema.sql)
//
// Design decision: a case is created as soon as the customer's first message
// comes in, even if most fields are still missing (Option A) — so nothing is
// lost if the customer stops responding partway through. It's completed by
// merging in each follow-up answer until missing_fields is empty.
//
// SECURITY: getCaseForCustomer() checks that the requester's phone number
// matches the case's customer_contact before returning any details, so a
// guessed/overheard case number alone isn't enough to read someone else's
// fraud report.

import { db } from "./connection.js";
import { generateCaseId } from "../utils/caseId.js";
import { normalizePhoneNumber } from "../utils/phone.js";
import { REQUIRED_FIELDS } from "../services/llm.js";

const VALID_STATUSES = ["received", "under_review", "resolved"];

function toRow(caseObj) {
  return {
    ...caseObj,
    missing_fields: JSON.stringify(caseObj.missing_fields ?? []),
    audio_refs: JSON.stringify(caseObj.audio_refs ?? []),
    suspected_number_normalized: caseObj.suspected_number ? normalizePhoneNumber(caseObj.suspected_number) : null,
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    ...row,
    missing_fields: JSON.parse(row.missing_fields || "[]"),
    audio_refs: JSON.parse(row.audio_refs || "[]"),
  };
}

/**
 * Creates a new case, even if some/most fields are still missing.
 *
 * @param {object} params
 * @param {string} params.customer_contact
 * @param {"whatsapp"|"ussd"} params.channel
 * @param {"voice"|"text"|"guided"} params.input_mode
 * @param {string} [params.language="twi"]
 * @param {object} params.caseFields - Output of llm.js's buildCase().case
 * @param {string[]} params.missing_fields - Output of llm.js's buildCase().missing_fields
 * @param {string} [params.audio_ref] - A WhatsApp media id, if this first
 *   message was a voice note. Stored as the first entry of audio_refs —
 *   see updateCaseFields for how later voice notes get appended.
 * @returns {object} The full stored case, including its case_id.
 */
const INSERT_CASE_SQL = `INSERT INTO cases (
  case_id, customer_contact, channel, input_mode, language,
  incident_summary, incident_date, amount, fraud_category,
  suspected_number, suspected_number_normalized, transaction_id, missing_fields, status, audio_refs
) VALUES (
  @case_id, @customer_contact, @channel, @input_mode, @language,
  @incident_summary, @incident_date, @amount, @fraud_category,
  @suspected_number, @suspected_number_normalized, @transaction_id, @missing_fields, @status, @audio_refs
)`;

const MAX_CASE_ID_ATTEMPTS = 5;

export function createCase({
  customer_contact,
  channel,
  input_mode,
  language = "twi",
  caseFields,
  missing_fields,
  audio_ref = null,
  generateId = generateCaseId, // overridable in tests to force/prove collision retries
}) {
  const status = "received";
  const audio_refs = audio_ref ? [audio_ref] : [];

  // generateCaseId() is random, not sequential — an ID collision is
  // possible (however unlikely) at high volume, and should never lose the
  // customer's report. Retry with a fresh ID instead of letting the
  // database's unique-constraint error bubble up as a failed submission.
  for (let attempt = 1; attempt <= MAX_CASE_ID_ATTEMPTS; attempt++) {
    const case_id = generateId();
    try {
      db.prepare(INSERT_CASE_SQL).run(
        toRow({
          case_id,
          customer_contact,
          channel,
          input_mode,
          language,
          audio_refs,
          status,
          ...caseFields,
          missing_fields,
        })
      );
      return fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(case_id));
    } catch (err) {
      const isCollision = err.code === "SQLITE_CONSTRAINT_PRIMARYKEY" || err.code === "SQLITE_CONSTRAINT_UNIQUE";
      if (!isCollision || attempt === MAX_CASE_ID_ATTEMPTS) throw err;
    }
  }
}

/**
 * Merges newly-extracted fields (e.g. from a follow-up answer) into an
 * existing case's known fields, without overwriting fields already filled.
 *
 * @param {object} existing - The stored case (as returned by fromRow).
 * @param {object} incoming - New field values from llm.js's buildCase().case.
 * @returns {{ fields: object, missing_fields: string[] }}
 */
export function mergeCaseFields(existing, incoming) {
  const fields = {};
  for (const field of ["incident_summary", "incident_date", "amount", "fraud_category", "suspected_number", "transaction_id"]) {
    fields[field] = existing[field] ?? incoming[field] ?? null;
  }
  const missing_fields = REQUIRED_FIELDS.filter((field) => fields[field] === null || fields[field] === undefined);
  return { fields, missing_fields };
}

/**
 * Applies a merged set of fields to a case in the database.
 *
 * @param {string} caseId
 * @param {object} fields
 * @param {string[]} missingFields
 * @param {string} [audioRef] - A WhatsApp media id for a voice note received
 *   on this turn, if any. Appended to the case's existing audio_refs list —
 *   every voice note sent across the conversation is kept, not just the
 *   most recent one. Omit (or pass null/undefined) if this turn was text,
 *   so a typed follow-up answer doesn't add a phantom entry.
 * @returns {object} The updated case.
 */
export function updateCaseFields(caseId, fields, missingFields, audioRef) {
  const existing = fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId));
  const audio_refs = audioRef ? [...(existing?.audio_refs ?? []), audioRef] : (existing?.audio_refs ?? []);

  db.prepare(
    `UPDATE cases SET
      incident_summary = @incident_summary,
      incident_date = @incident_date,
      amount = @amount,
      fraud_category = @fraud_category,
      suspected_number = @suspected_number,
      suspected_number_normalized = @suspected_number_normalized,
      transaction_id = @transaction_id,
      missing_fields = @missing_fields,
      audio_refs = @audio_refs,
      updated_at = datetime('now')
    WHERE case_id = @case_id`
  ).run(toRow({ case_id: caseId, ...fields, missing_fields: missingFields, audio_refs }));

  return fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId));
}

/**
 * Looks up a case by id with no phone-ownership check — for staff/dashboard
 * use only, where requireDashboardAuth already gates access to every case.
 * getCaseForCustomer (above) is the customer-facing equivalent that DOES
 * check phone ownership; don't use this one for anything a customer triggers.
 *
 * @param {string} caseId
 * @returns {object|null}
 */
export function getCaseById(caseId) {
  return fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId));
}

/**
 * Looks up a case by case number, but only returns it if requesterPhone
 * matches the case's customer_contact. Returns null in every other
 * situation (not found, or phone mismatch) so a wrong guess can't be used
 * to confirm a case number exists.
 *
 * @param {string} caseId
 * @param {string} requesterPhone
 * @returns {object|null}
 */
export function getCaseForCustomer(caseId, requesterPhone) {
  const row = fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId));
  if (!row) return null;
  if (normalizePhoneNumber(row.customer_contact) !== normalizePhoneNumber(requesterPhone)) return null;
  return row;
}

/**
 * Updates a case's status. Throws if the status isn't one of the 3 valid values.
 *
 * @param {string} caseId
 * @param {"received"|"under_review"|"resolved"} status
 * @returns {object} The updated case.
 */
export function updateCaseStatus(caseId, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status "${status}". Must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  db.prepare("UPDATE cases SET status = ?, updated_at = datetime('now') WHERE case_id = ?").run(status, caseId);
  return fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(caseId));
}

/**
 * Returns every stored case — used by alerts.js to check for fraud pattern
 * matches, and by the dashboard to list cases.
 *
 * @returns {object[]}
 */
export function getAllCases() {
  return db.prepare("SELECT * FROM cases ORDER BY created_at DESC").all().map(fromRow);
}

/**
 * Finds other cases that share a suspected number, using the indexed
 * suspected_number_normalized column instead of loading the whole table —
 * used by alerts.js's fraud matching, which used to call getAllCases() on
 * every single completed report. That scaled linearly with the total
 * number of cases ever created (measured ~565ms / ~19MB at 50,000 rows,
 * blocking the whole server for that duration since better-sqlite3 is
 * synchronous); this scales with the number of matches instead, which stays
 * small regardless of how many total cases exist.
 *
 * @param {string} normalizedNumber - Already-normalized (see utils/phone.js).
 * @param {string} excludeCaseId - The case that triggered the check, so it's not matched against itself.
 * @returns {object[]}
 */
export function getCasesBySuspectedNumber(normalizedNumber, excludeCaseId) {
  if (!normalizedNumber) return [];
  return db
    .prepare("SELECT * FROM cases WHERE suspected_number_normalized = ? AND case_id != ?")
    .all(normalizedNumber, excludeCaseId)
    .map(fromRow);
}

/**
 * Finds this customer's most recent incomplete case, if any — used by
 * whatsapp.js/ussd.js to decide whether an incoming message is a new
 * report or the answer to a pending follow-up question.
 *
 * @param {string} customerContact
 * @returns {object|null}
 */
export function getOpenCaseForCustomer(customerContact) {
  const normalized = normalizePhoneNumber(customerContact);
  const rows = db
    .prepare("SELECT * FROM cases WHERE missing_fields != '[]' ORDER BY created_at DESC")
    .all()
    .map(fromRow);
  return rows.find((row) => normalizePhoneNumber(row.customer_contact) === normalized) ?? null;
}
