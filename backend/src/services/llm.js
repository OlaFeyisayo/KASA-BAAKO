// Step 3: Anthropic — turn free text into a structured case (see db/schema.sql),
// flag missing required fields, generate a Twi follow-up question for each one

const REQUIRED_FIELDS = [
  "incident_summary",
  "incident_date",
  "amount",
  "fraud_category",
  "suspected_number",
];

const SYSTEM_PROMPT = `You are an assistant that extracts fraud report details from a customer's message (originally spoken or typed in Twi, already transcribed to text) and organizes it into a structured case file.

Extract these fields when present:
- incident_summary: a short description of what happened
- incident_date: when it happened (as stated by the customer)
- amount: the amount of money involved (number only, no currency symbol)
- fraud_category: type of fraud (e.g. "impersonation", "fake prize", "wrong transfer", "SIM swap", etc.)
- suspected_number: the suspected scammer's phone number, if mentioned
- transaction_id: transaction reference number, if mentioned (optional)

Respond ONLY with a JSON object with this exact shape, no other text:
{
  "case": {
    "incident_summary": ... or null,
    "incident_date": ... or null,
    "amount": ... or null,
    "fraud_category": ... or null,
    "suspected_number": ... or null,
    "transaction_id": ... or null
  },
  "missing_fields": ["field_name", ...],
  "follow_up_questions": { "field_name": "question in Twi", ... }
}

A field is "missing" only if it is null AND it is one of: incident_summary, incident_date, amount, fraud_category, suspected_number (transaction_id is optional and never counts as missing). Write a follow_up_question only for each missing required field, as one short, clear question in Twi.`;

/**
 * Turns free text (from ASR or typed input) into a structured fraud case.
 *
 * @param {string} text - The customer's report, in text form.
 * @returns {Promise<{ case: object, missing_fields: string[], follow_up_questions: Record<string, string> }>}
 */
export async function buildCase(text) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`Anthropic API error: ${message}`);
  }

  const raw = data.content?.[0]?.text ?? "";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM did not return valid JSON");
  }

  return parsed;
}

export { REQUIRED_FIELDS };
