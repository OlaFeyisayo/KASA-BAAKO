/**
 * Normalizes an email address so equivalent casing compares equal for fraud
 * matching (e.g. "Scammer@Gmail.com" and "scammer@gmail.com" match).
 */
export function normalizeEmail(email) {
  if (!email) return "";
  return String(email).trim().toLowerCase();
}
