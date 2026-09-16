import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWhatsAppSignature } from "./verifySignature.js";

const SECRET = "test-app-secret";

function fakeReq({ rawBody, signature }) {
  return {
    rawBody: Buffer.from(rawBody),
    get(header) {
      if (header === "X-Hub-Signature-256") return signature;
      return undefined;
    },
  };
}

function fakeRes() {
  const res = { statusCode: null, sendStatus(code) { this.statusCode = code; } };
  return res;
}

function sign(body, secret = SECRET) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

test("rejects a request with no signature header", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const req = fakeReq({ rawBody: '{"a":1}', signature: undefined });
  const res = fakeRes();
  let nextCalled = false;
  verifyWhatsAppSignature(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a request signed with the wrong secret", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const body = '{"a":1}';
  const req = fakeReq({ rawBody: body, signature: sign(body, "wrong-secret") });
  const res = fakeRes();
  let nextCalled = false;
  verifyWhatsAppSignature(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a request whose body was tampered with after signing", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const signedBody = '{"a":1}';
  const tamperedReq = fakeReq({ rawBody: '{"a":2}', signature: sign(signedBody) });
  const res = fakeRes();
  let nextCalled = false;
  verifyWhatsAppSignature(tamperedReq, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("allows a correctly signed request through", () => {
  process.env.WHATSAPP_APP_SECRET = SECRET;
  const body = '{"a":1}';
  const req = fakeReq({ rawBody: body, signature: sign(body) });
  const res = fakeRes();
  let nextCalled = false;
  verifyWhatsAppSignature(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("fails open (with a warning) only when WHATSAPP_APP_SECRET isn't configured at all", () => {
  delete process.env.WHATSAPP_APP_SECRET;
  const req = fakeReq({ rawBody: "{}", signature: undefined });
  const res = fakeRes();
  let nextCalled = false;
  verifyWhatsAppSignature(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  process.env.WHATSAPP_APP_SECRET = SECRET; // restore for any later tests
});
