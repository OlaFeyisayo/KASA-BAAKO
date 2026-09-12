// Step 2: Khaya ASR — send audio, get back Twi text transcript
// API: https://translation-api.ghananlp.org/asr/v3

const ASR_BASE_URL = "https://translation-api.ghananlp.org/asr/v3";
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Transcribes an audio clip to text using the Khaya ASR v3 API.
 *
 * @param {Buffer} audioBuffer - Raw audio bytes (mp3, wav, flac, or ogg).
 * @param {Object} [options]
 * @param {string} [options.language="twi"] - ISO 639-3 language code.
 * @param {string} [options.contentType="audio/mpeg"] - MIME type of the audio.
 * @param {"word"|"segment"} [options.timestamps] - Optional timing granularity.
 * @returns {Promise<{ text: string, timings?: object }>}
 */
export async function transcribeAudio(audioBuffer, options = {}) {
  const { language = "twi", contentType = "audio/mpeg", timestamps } = options;

  const url = new URL(`${ASR_BASE_URL}/transcribe`);
  url.searchParams.set("language", language);
  if (timestamps) url.searchParams.set("timestamps", timestamps);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": contentType,
        "Ocp-Apim-Subscription-Key": process.env.KHAYA_API_KEY,
      },
      body: audioBuffer,
    });
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Khaya ASR request timed out");
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || "ASR request failed";
    throw new Error(`Khaya ASR error: ${message}`);
  }

  return data;
}
