import { test } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDbPath = join(__dirname, "..", "..", "data", "kasabaako.callbacks-test.db");
for (const suffix of ["", "-wal", "-shm"]) rmSync(testDbPath + suffix, { force: true });
process.env.DB_PATH = testDbPath;

const { createCallbackRequest, getPendingCallbackRequests, markCallbackDone } = await import("./callbacks.js");

test("createCallbackRequest records a pending request", () => {
  const { request, alreadyPending } = createCallbackRequest({ customer_contact: "233244700001", language: "english" });
  assert.equal(alreadyPending, false);
  assert.equal(request.status, "pending");
  assert.equal(request.language, "english");
});

test("asking twice (even from a differently-formatted number) doesn't queue the customer twice", () => {
  createCallbackRequest({ customer_contact: "233244700002" });
  const again = createCallbackRequest({ customer_contact: "0244700002" });

  assert.equal(again.alreadyPending, true);
  const forThem = getPendingCallbackRequests().filter((r) => r.customer_contact.endsWith("244700002"));
  assert.equal(forThem.length, 1);
});

test("markCallbackDone removes it from the pending list, and a done customer can ask again", () => {
  const { request } = createCallbackRequest({ customer_contact: "233244700003" });
  const done = markCallbackDone(request.id);

  assert.equal(done.status, "done");
  assert.ok(done.resolved_at);
  assert.ok(!getPendingCallbackRequests().some((r) => r.id === request.id));

  const second = createCallbackRequest({ customer_contact: "233244700003" });
  assert.equal(second.alreadyPending, false);
});

test("markCallbackDone returns null for an unknown id", () => {
  assert.equal(markCallbackDone(999999), null);
});

test("pending requests come back oldest first", () => {
  const ids = getPendingCallbackRequests().map((r) => r.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b));
});
