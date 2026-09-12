// Step 8: fraud matching — when a new case is created, check if its
// suspected_number/transaction pattern matches another recent case,
// and notify the other affected customer(s)

const MATCH_WINDOW_DAYS = 30;
const MTN_ESCALATION_THRESHOLD = 5;

/**
 * Finds existing cases that share the new case's suspected number and
 * were reported within the last MATCH_WINDOW_DAYS days.
 *
 * @param {object} newCase - The case just created (must have suspected_number, created_at, case_id).
 * @param {object[]} existingCases - All other stored cases to check against.
 * @returns {object[]} Matching cases (excluding the new case itself).
 */
export function findMatchingCases(newCase, existingCases) {
  if (!newCase.suspected_number) return [];

  const windowMs = MATCH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const newCaseTime = new Date(newCase.created_at).getTime();

  return existingCases.filter((c) => {
    if (c.case_id === newCase.case_id) return false;
    if (c.suspected_number !== newCase.suspected_number) return false;

    const caseTime = new Date(c.created_at).getTime();
    return Math.abs(newCaseTime - caseTime) <= windowMs;
  });
}

/**
 * Builds a Twi-language alert message warning a customer that the number
 * suspected in their case has been reported again in another case.
 *
 * @param {object} matchedCase - One of the cases returned by findMatchingCases.
 * @returns {string} Alert message in Twi.
 */
export function buildAlertMessage(matchedCase) {
  return `Amaneɛ: Yɛahu sɛ obi foforɔ nso abɔ nsraeɛ wɔ nɔma a wode too soɔ (${matchedCase.suspected_number}) ho amaneɛbɔ foforɔ. Yɛsrɛ sɛ hwɛ wo Mobile Money akontaabu yiye na sɛ biribi kyerɛ sɛ ɛnyɛ deɛ, bɔ amaneɛ ntɛm ara.`;
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
 * suspected number that has crossed the mass-alert threshold.
 *
 * @param {object} newCase - The case that triggered the escalation.
 * @param {object[]} matches - Result of findMatchingCases().
 * @returns {string} Notice text in English, for MTN staff.
 */
export function buildMTNEscalationNotice(newCase, matches) {
  const totalReports = matches.length + 1;
  return `HIGH ALERT: The number ${newCase.suspected_number} has been reported ${totalReports} times in the last ${MATCH_WINDOW_DAYS} days. Consider sending a mass fraud warning to all MTN Mobile Money customers about this number.`;
}
