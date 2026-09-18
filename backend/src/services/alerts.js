// Step 8: fraud matching — when a new case is created, check if its
// suspected_number/transaction pattern matches another recent case,
// and notify the other affected customer(s)

import { normalizePhoneNumber } from "../utils/phone.js";
import { normalizeEmail } from "../utils/email.js";

const MATCH_WINDOW_DAYS = 30;
const MTN_ESCALATION_THRESHOLD = 5;

/**
 * Finds existing cases that share the new case's suspected number OR
 * suspected email, and were reported within the last MATCH_WINDOW_DAYS days.
 * A candidate can match on either identifier — a scammer reported by phone
 * number in one case and by phishing email in another still counts.
 *
 * @param {object} newCase - The case just created (must have created_at, case_id, and suspected_number and/or suspected_email).
 * @param {object[]} existingCases - Candidate cases to check against (already narrowed to ones sharing a number or email — see db/cases.js's getCasesBySuspectedNumber/getCasesBySuspectedEmail).
 * @returns {object[]} Matching cases (excluding the new case itself), each with an added `matchedOn: "number"|"email"` field.
 */
export function findMatchingCases(newCase, existingCases) {
  const newNumber = newCase.suspected_number ? normalizePhoneNumber(newCase.suspected_number) : null;
  const newEmail = newCase.suspected_email ? normalizeEmail(newCase.suspected_email) : null;
  if (!newNumber && !newEmail) return [];

  const windowMs = MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const newCaseTime = new Date(newCase.created_at).getTime();
  const newCustomer = normalizePhoneNumber(newCase.customer_contact);

  const matches = [];
  const seenCaseIds = new Set();
  for (const c of existingCases) {
    if (c.case_id === newCase.case_id || seenCaseIds.has(c.case_id)) continue;
    // Never "alert" a customer about a number/email they reported themselves
    // — that isn't someone else being affected, it's their own earlier case.
    if (normalizePhoneNumber(c.customer_contact) === newCustomer) continue;

    const caseTime = new Date(c.created_at).getTime();
    if (Number.isNaN(newCaseTime) || Number.isNaN(caseTime)) continue;
    if (Math.abs(newCaseTime - caseTime) > windowMs) continue;

    const numberMatch = newNumber && c.suspected_number && normalizePhoneNumber(c.suspected_number) === newNumber;
    const emailMatch = newEmail && c.suspected_email && normalizeEmail(c.suspected_email) === newEmail;
    if (!numberMatch && !emailMatch) continue;

    seenCaseIds.add(c.case_id);
    matches.push({ ...c, matchedOn: numberMatch ? "number" : "email" });
  }
  return matches;
}

/**
 * Builds a Twi-language alert message warning a customer that the number or
 * email suspected in their case has been reported again in another case.
 *
 * @param {object} matchedCase - One of the cases returned by findMatchingCases (carries `matchedOn`).
 * @returns {string} Alert message in Twi. (The "email" phrasing keeps the
 *   English word as a loanword, matching how it's commonly said in Twi.)
 */
export function buildAlertMessage(matchedCase) {
  const target =
    matchedCase.matchedOn === "email"
      ? `email (${matchedCase.suspected_email})`
      : `nɔma a wode too soɔ (${matchedCase.suspected_number})`;
  return `Amaneɛ: Yɛahu sɛ obi foforɔ nso abɔ nsraeɛ wɔ ${target} ho amaneɛbɔ foforɔ. Yɛsrɛ sɛ hwɛ wo Mobile Money akontaabu yiye na sɛ biribi kyerɛ sɛ ɛnyɛ deɛ, bɔ amaneɛ ntɛm ara.`;
}

/**
 * Decides whether a suspected number has been reported often enough
 * (including the new case) to warrant MTN sending a mass customer alert
 * instead of just notifying individual past reporters.
 *
 * @param {object[]} matches - Result of findMatchingCases().
 * @returns {boolean}
 */
export function shouldEscalateToMTN(matches) {
  const totalReports = matches.length + 1; // +1 for the new case itself
  return totalReports >= MTN_ESCALATION_THRESHOLD;
}

/**
 * Builds an English notice for the MTN staff dashboard, flagging a
 * suspected number and/or email that has crossed the mass-alert threshold.
 *
 * @param {object} newCase - The case that triggered the escalation.
 * @param {object[]} matches - Result of findMatchingCases().
 * @returns {string} Notice text in English, for MTN staff.
 */
export function buildMTNEscalationNotice(newCase, matches) {
  const totalReports = matches.length + 1;
  const identifiers = [newCase.suspected_number, newCase.suspected_email].filter(Boolean).join(" / ");
  return `HIGH ALERT: ${identifiers} has been reported ${totalReports} times in the last ${MATCH_WINDOW_DAYS} days. Consider sending a mass fraud warning to all MTN Mobile Money customers about this number/email.`;
}
