// Generates non-guessable case numbers.
//
// IMPORTANT: a non-guessable ID alone isn't enough — cases.js's "look up
// a case by case number" function must ALSO check that the caller's phone
// number matches the case's customer_contact before returning any details.
// Otherwise someone who happens to see/guess a case number could read
// another customer's fraud report.

import { randomInt } from "node:crypto";

/**
 * Generates a case number like "KB-481902773506" — not sequential, not
 * guessable.
 *
 * Digits only, on purpose: the bot reads this number aloud to customers who
 * can't read the screen, and Khaya's voices could only pronounce digits
 * cleanly (letters and numerals came out as gibberish in Twi; digits spoken
 * as words are intelligible in both languages). Digits are also easier to
 * dictate and to type on a phone keypad. Older hex-style ids
 * ("KB-7F3A9C2D1B8E") already in the database keep working.
 *
 * 12 random digits (~1 trillion ids). An earlier 32-bit id collided for real
 * after only ~10,000-50,000 cases; at this size the odds are ~0.1% by
 * 50,000 cases, and createCase() still retries on a collision as a backstop.
 */
export function generateCaseId() {
  const random = String(randomInt(0, 1_000_000_000_000)).padStart(12, "0");
  return `KB-${random}`;
}
