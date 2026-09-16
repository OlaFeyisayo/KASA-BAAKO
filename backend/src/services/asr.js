// Step 2: Khaya ASR — send audio, get back Twi text transcript
// API: https://translation-api.ghananlp.org/asr/v3

const ASR_BASE_URL = "https://translation-api.ghananlp.org/asr/v3";

// A fixed timeout can't serve both a 10-second and a 10-minute voice note
// well: too short and it needlessly fails long (but legitimate) recordings;
// too long and every SHORT recording holds a connection open pointlessly
// (and a genuinely dead connection takes forever to fail). Scaling by audio
// size (the only thing we know about it without decoding it) gives long
// recordings a real shot at succeeding while keeping short ones snappy.
//
// This can't be made literally unlimited — an unbounded wait is its own
// reliability problem regardless of whether it eventually succeeds (dead
// connections need to fail sometime, and the customer needs a response
// eventually) — but it's now generous enough that only a truly extreme
// recording or a real outage hits the ceiling, and that failure recovers
// gracefully (see channels/whatsapp.js's runReportTurn) instead of just
// dying.
const MIN_TIMEOUT_MS = 45000; // 45s floor — covers Khaya's base overhead even for a tiny clip
const MAX_TIMEOUT_MS = 240000; // 4 minutes — a real ceiling per attempt; see retry below
const TIMEOUT_MS_PER_KB = 300; // generous: real cloud ASR processes far faster than this

export function computeTimeoutMs(audioBuffer) {
  const sizeKb = audioBuffer.length / 1024;
  const scaled = sizeKb * TIMEOUT_MS_PER_KB;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, scaled));
}

// Distinguishes "Khaya took too long to respond" (worth retrying once —
// transient network/load blips are common) from a real API error like a
// bad key or rejected audio format, which will fail identically every
// time and just wastes the customer's wait by retrying it.
class AsrTimeoutError extends Error {}

const MAX_ATTEMPTS = 2; // 1 initial + 1 retry

async function attemptTranscribe(audioBuffer, { language, contentType, timestamps, timeoutMs }) {
  const url = new URL(`${ASR_BASE_URL}/transcribe`);
  url.searchParams.set("language", language);
  if (timestamps) url.searchParams.set("timestamps", timestamps);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    if (err.name === "AbortError") throw new AsrTimeoutError("Khaya ASR request timed out");
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

/**
 * Transcribes an audio clip to text using the Khaya ASR v3 API. Retries
 * once on a timeout (not on a real API error, which would just fail the
 * same way again); the timeout itself scales with audio size — see the
 * constants above for why this still can't be made literally unlimited.
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
  const timeoutMs = computeTimeoutMs(audioBuffer);

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptTranscribe(audioBuffer, { language, contentType, timestamps, timeoutMs });
    } catch (err) {
      lastErr = err;
      if (!(err instanceof AsrTimeoutError) || attempt === MAX_ATTEMPTS) throw err;
      console.warn(`[asr] attempt ${attempt}/${MAX_ATTEMPTS} timed out after ${timeoutMs}ms, retrying...`);
    }
  }
  throw lastErr;
}
