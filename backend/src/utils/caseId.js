// Generates non-guessable case numbers.
//
// IMPORTANT: a non-guessable ID alone isn't enough — cases.js's "look up
// a case by case number" function must ALSO check that the caller's phone
// number matches the case's customer_contact before returning any details.
// Otherwise someone who happens to see/guess a case number could read
// another customer's fraud report.

import { randomBytes } from "node:crypto";

/**
 * Generates a case number like "KB-7F3A9C2D" — not sequential, not guessable.
 */
export function generateCaseId() {
  const random = randomBytes(4).toString("hex").toUpperCase();
  return `KB-${random}`;
}
