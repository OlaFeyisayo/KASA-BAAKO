/**
 * Normalizes a Ghanaian phone number so equivalent formats compare equal
 * (e.g. "0244123456", "+233244123456", "233244123456" all become "244123456").
 */
export function normalizePhoneNumber(number) {
  if (!number) return "";
  let digits = String(number).replace(/\D/g, "");
  if (digits.startsWith("233")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}
