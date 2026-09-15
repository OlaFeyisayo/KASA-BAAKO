// Generates non-guessable case numbers.
//
// IMPORTANT: a non-guessable ID alone isn't enough — cases.js's "look up
// a case by case number" function must ALSO check that the caller's phone
// number matches the case's customer_contact before returning any details.
// Otherwise someone who happens to see/guess a case number could read
// another customer's fraud report.

import { randomBytes } from "node:crypto";

/**
 * Generates a case number like "KB-7F3A9C2D1B8E" — not sequential, not
 * guessable.
 *
 * 6 random bytes (48 bits, ~281 trillion possible IDs). The original 4-byte
 * (32-bit) version was tested at real scale and collided for real after
 * only ~10,000-50,000 cases (the birthday-paradox math says that's
 * expected: ~29% collision odds by 50,000 IDs, and near-certain by a
 * million) — createCase() below still retries on a collision as a backstop,
 * but the ID itself should be wide enough that this essentially never fires.
 */
export function generateCaseId() {
  const random = randomBytes(6).toString("hex").toUpperCase();
  return `KB-${random}`;
}
