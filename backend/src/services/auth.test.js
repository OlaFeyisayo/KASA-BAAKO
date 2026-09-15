import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  login,
  logout,
  isValidSession,
  requireDashboardAuth,
  requireServiceApiKey,
  requireUssdWebhookToken,
  _resetSessionsForTests,
  _createSessionForTests,
} from "./auth.js";

beforeEach(() => {
  _resetSessionsForTests();
  process.env.DASHBOARD_PASSWORD = "test-password-123";
  process.env.SERVICE_API_KEY = "test-service-key-456";
  process.env.USSD_WEBHOOK_TOKEN = "test-ussd-token-789";
});

test("login issues a token for the correct password", () => {
  const token = login("test-password-123");
  assert.equal(typeof token, "string");
  assert.ok(token.length > 0);
  assert.equal(isValidSession(token), true);
});

test("login refuses a wrong password", () => {
  assert.equal(login("wrong-password"), null);
});

test("login refuses when DASHBOARD_PASSWORD isn't configured", () => {
  delete process.env.DASHBOARD_PASSWORD;
  assert.equal(login("anything"), null);
});

test("isValidSession rejects an unknown token", () => {
  assert.equal(isValidSession("not-a-real-token"), false);
  assert.equal(isValidSession(""), false);
  assert.equal(isValidSession(undefined), false);
});

test("logout invalidates the session", () => {
  const token = login("test-password-123");
  logout(token);
  assert.equal(isValidSession(token), false);
});

test("isValidSession rejects an expired token", () => {
  const expiredToken = _createSessionForTests(Date.now() - 1000); // expired 1s ago
  assert.equal(isValidSession(expiredToken), false);
});

function fakeRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  res.send = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

test("requireDashboardAuth blocks a missing Authorization header", () => {
  const req = { headers: {} };
  const res = fakeRes();
  let nextCalled = false;
  requireDashboardAuth(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});

test("requireDashboardAuth allows a valid Bearer token through", () => {
  const token = login("test-password-123");
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = fakeRes();
  let nextCalled = false;
  requireDashboardAuth(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});

test("requireServiceApiKey blocks a wrong or missing x-api-key", () => {
  const res1 = fakeRes();
  let next1 = false;
  requireServiceApiKey({ headers: {} }, res1, () => (next1 = true));
  assert.equal(next1, false);
  assert.equal(res1.statusCode, 401);

  const res2 = fakeRes();
  let next2 = false;
  requireServiceApiKey({ headers: { "x-api-key": "wrong" } }, res2, () => (next2 = true));
  assert.equal(next2, false);
  assert.equal(res2.statusCode, 401);
});

test("requireServiceApiKey allows the correct x-api-key through", () => {
  const req = { headers: { "x-api-key": "test-service-key-456" } };
  const res = fakeRes();
  let nextCalled = false;
  requireServiceApiKey(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
});

test("requireUssdWebhookToken blocks a missing or wrong token query param", () => {
  const res1 = fakeRes();
  let next1 = false;
  requireUssdWebhookToken({ query: {} }, res1, () => (next1 = true));
  assert.equal(next1, false);
  assert.equal(res1.statusCode, 401);

  const res2 = fakeRes();
  let next2 = false;
  requireUssdWebhookToken({ query: { token: "wrong" } }, res2, () => (next2 = true));
  assert.equal(next2, false);
  assert.equal(res2.statusCode, 401);
});

test("requireUssdWebhookToken allows the correct token through", () => {
  const req = { query: { token: "test-ussd-token-789" } };
  const res = fakeRes();
  let nextCalled = false;
  requireUssdWebhookToken(req, res, () => (nextCalled = true));
  assert.equal(nextCalled, true);
});
