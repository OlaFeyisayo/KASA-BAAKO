import { test } from "node:test";
import assert from "node:assert/strict";
import { transcribeAudio, computeTimeoutMs } from "./asr.js";

test("computeTimeoutMs floors at 45s for a tiny clip", () => {
  const tiny = Buffer.alloc(1024); // 1KB
  assert.equal(computeTimeoutMs(tiny), 45000);
});

test("computeTimeoutMs caps at 4 minutes for a very large clip", () => {
  const oneMb = Buffer.alloc(1024 * 1024); // far past the ceiling once scaled
  assert.equal(computeTimeoutMs(oneMb), 240000);
});

test("computeTimeoutMs scales between the floor and ceiling for a moderate clip", () => {
  const moderate = Buffer.alloc(300 * 1024); // 300KB * 300ms/KB = 90000ms
  const ms = computeTimeoutMs(moderate);
  assert.ok(ms > 45000 && ms < 240000, `expected strictly between floor and ceiling, got ${ms}`);
});

test("transcribeAudio retries once after a timeout, then succeeds", async (t) => {
  let callCount = 0;
  t.mock.method(global, "fetch", async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    return { ok: true, json: async () => ({ text: "someone called me" }) };
  });

  const result = await transcribeAudio(Buffer.from("fake audio"));
  assert.equal(result.text, "someone called me");
  assert.equal(callCount, 2, "expected exactly one retry after the first timeout");
});

test("transcribeAudio gives up after exhausting retries on repeated timeouts", async (t) => {
  let callCount = 0;
  t.mock.method(global, "fetch", async () => {
    callCount++;
    const err = new Error("aborted");
    err.name = "AbortError";
    throw err;
  });

  await assert.rejects(() => transcribeAudio(Buffer.from("fake audio")), /timed out/);
  assert.equal(callCount, 2, "expected exactly 2 attempts (1 initial + 1 retry), not an infinite/unbounded loop");
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
