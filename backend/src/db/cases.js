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
  };
}

function fromRow(row) {
  if (!row) return null;
  return {
    ...row,
    missing_fields: JSON.parse(row.missing_fields || "[]"),
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
 * @param {string} [params.audio_ref]
 * @returns {object} The full stored case, including its case_id.
 */
export function createCase({ customer_contact, channel, input_mode, language = "twi", caseFields, missing_fields, audio_ref = null }) {
  const case_id = generateCaseId();
  const status = "received";

  db.prepare(
    `INSERT INTO cases (
      case_id, customer_contact, channel, input_mode, language,
      incident_summary, incident_date, amount, fraud_category,
      suspected_number, transaction_id, missing_fields, status, audio_ref
    ) VALUES (
      @case_id, @customer_contact, @channel, @input_mode, @language,
      @incident_summary, @incident_date, @amount, @fraud_category,
      @suspected_number, @transaction_id, @missing_fields, @status, @audio_ref
    )`
  ).run(
    toRow({
      case_id,
      customer_contact,
      channel,
      input_mode,
      language,
      audio_ref,
      status,
      ...caseFields,
      missing_fields,
    })
  );

  return fromRow(db.prepare("SELECT * FROM cases WHERE case_id = ?").get(case_id));
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
 * @returns {object} The updated case.
 */
export function updateCaseFields(caseId, fields, missingFields) {
  db.prepare(
    `UPDATE cases SET
      incident_summary = @incident_summary,
      incident_date = @incident_date,
      amount = @amount,
      fraud_category = @fraud_category,
      suspected_number = @suspected_number,
      transaction_id = @transaction_id,
      missing_fields = @missing_fields,
      updated_at = datetime('now')
    WHERE case_id = @case_id`
  ).run(toRow({ case_id: caseId, ...fields, missing_fields: missingFields }));

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
