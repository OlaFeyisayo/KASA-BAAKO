// Step 4: Khaya TTS — send Twi text, get back spoken audio
// API: https://translation-api.ghananlp.org/tts/v2

const TTS_BASE_URL = "https://translation-api.ghananlp.org/tts/v2";

/**
 * Synthesizes Twi text into spoken audio using the Khaya TTS v2 API.
 *
 * @param {string} text - Text to synthesize.
 * @param {Object} [options]
 * @param {string} [options.language="twi"] - ISO 639-3 language code.
 * @param {string} [options.speakerId] - Voice to use (see GET /speakers). Defaults to Khaya's default voice.
 * @param {"wav"|"mp3"|"ogg"} [options.format="wav"] - Audio format of the response.
 * @returns {Promise<Buffer>} Raw audio bytes.
 */
export async function synthesizeSpeech(text, options = {}) {
  const { language = "twi", speakerId, format = "wav" } = options;

  const response = await fetch(`${TTS_BASE_URL}/synthesize`, {
    method: "POST",
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

  if (!response.ok) {
    const data = await response.json();
    const message = data?.error?.message || "TTS request failed";
    throw new Error(`Khaya TTS error: ${message}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
