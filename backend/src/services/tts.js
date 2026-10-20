// Step 4: Khaya TTS — send Twi text, get back spoken audio
// API: https://translation-api.ghananlp.org/tts/v2

const TTS_BASE_URL = "https://translation-api.ghananlp.org/tts/v2";
// Khaya's response time varies a lot (a 15s limit failed on longer sentences
// like a spelled-out case number). Callers that speak to a customer send the
// text first and let audio follow, so a long wait here only delays the audio.
const REQUEST_TIMEOUT_MS = 40000;

/**
 * Synthesizes Twi text into spoken audio using the Khaya TTS v2 API.
 *
 * @param {string} text - Text to synthesize.
 * @param {Object} [options]
 * @param {string} [options.language="twi"] - ISO 639-3 language code.
 * @param {string} [options.speakerId] - Voice to use: "male_low", "male_high", or "female"
 *   (same 3 voices across every language Khaya supports). Defaults to the
 *   KHAYA_SPEAKER_ID env var if set, otherwise Khaya's own default voice —
 *   set on Render without a code change to switch which voice every
 *   customer hears.
 * @param {"wav"|"mp3"|"ogg"} [options.format="wav"] - Audio format of the response.
 * @returns {Promise<Buffer>} Raw audio bytes.
 */
export async function synthesizeSpeech(text, options = {}) {
  const { language = "twi", speakerId = process.env.KHAYA_SPEAKER_ID, format = "wav" } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(`${TTS_BASE_URL}/synthesize`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": process.env.KHAYA_API_KEY,
      },
      body: JSON.stringify({
        text,
        language,
        speaker_id: speakerId,
        format,
      }),
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Khaya TTS request timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const data = await response.json();
    const message = data?.error?.message || "TTS request failed";
    throw new Error(`Khaya TTS error: ${message}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
