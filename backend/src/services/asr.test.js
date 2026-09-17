import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribeAudio, computeTimeoutMs } from "./asr.js";

test("computeTimeoutMs floors at 60s for a tiny clip", () => {
  const tiny = Buffer.alloc(1024); // 1KB
  assert.equal(computeTimeoutMs(tiny), 60000);
});

test("computeTimeoutMs caps at 4 minutes for a very large clip", () => {
  const oneMb = Buffer.alloc(1024 * 1024); // far past the ceiling once scaled
  assert.equal(computeTimeoutMs(oneMb), 240000);
});

test("computeTimeoutMs scales between the floor and ceiling for a moderate clip", () => {
  const midSize = Buffer.alloc(700 * 1024); // 700KB * 300ms/KB = 210000ms
  const ms = computeTimeoutMs(midSize);
  assert.ok(ms > 60000 && ms < 240000, `expected strictly between floor and ceiling, got ${ms}`);
});

test("transcribeAudio retries after a timeout, then succeeds", async (t) => {
  let callCount = 0;
  t.mock.method(global, "fetch", async () => {
    callCount++;
    if (callCount < 2) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    return { ok: true, json: async () => ({ text: "someone called me" }) };
  });

  const result = await transcribeAudio(Buffer.from("fake audio"));
  assert.equal(result.text, "someone called me");
  assert.equal(callCount, 2, "expected to succeed on the first retry");
});

test("transcribeAudio gives up after exhausting all retries on repeated timeouts", async (t) => {
  let callCount = 0;
  t.mock.method(global, "fetch", async () => {
    callCount++;
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  });

  await assert.rejects(() => transcribeAudio(Buffer.from("fake audio")), /timed out/);
  assert.equal(callCount, 3, "expected exactly 3 attempts (1 initial + 2 retries), not an infinite/unbounded loop");
});

test("transcribeAudio does NOT retry a real API error — only a timeout is worth retrying", async (t) => {
  let callCount = 0;
  t.mock.method(global, "fetch", async () => {
    callCount++;
    return { ok: false, json: async () => ({ error: { message: "bad audio format" } }) };
  });

  await assert.rejects(() => transcribeAudio(Buffer.from("fake audio")), /bad audio format/);
  assert.equal(callCount, 1, "a real API error should fail immediately, not retry (it'll just fail the same way again)");
});
