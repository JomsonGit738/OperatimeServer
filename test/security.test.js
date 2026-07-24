const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.ACCESS_TOKEN_SECRET =
  "test-only-access-secret-that-is-long-enough-for-tests";

const {
  ACCESS_TOKEN_SECRET,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} = require("../config/security");
const {
  loginMiddleware,
  optionalLoginMiddleware,
} = require("../Middleware/routerSpecific");

const buildResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("session cookie is inaccessible to browser JavaScript", () => {
  const options = sessionCookieOptions();
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/api");
});

test("authentication accepts a valid signed session cookie", () => {
  const token = jwt.sign(
    { userEmail: "user@example.com" },
    ACCESS_TOKEN_SECRET,
    {
      subject: "507f1f77bcf86cd799439011",
      audience: "operatime-web",
      issuer: "operatime-server",
      expiresIn: "5m",
    }
  );
  const request = { cookies: { [SESSION_COOKIE_NAME]: token } };
  const response = buildResponse();
  let calledNext = false;

  loginMiddleware(request, response, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(request.userId, "507f1f77bcf86cd799439011");
  assert.equal(request.userEmail, "user@example.com");
});

test("authentication rejects a bearer header without the session cookie", () => {
  const request = {
    cookies: {},
    headers: { authorization: "Bearer browser-readable-token" },
  };
  const response = buildResponse();

  loginMiddleware(request, response, () => {
    assert.fail("middleware must not trust browser-managed bearer tokens");
  });

  assert.equal(response.statusCode, 401);
});

test("optional session discovery accepts a guest without returning 401", () => {
  const request = { cookies: {} };
  const response = buildResponse();
  let calledNext = false;

  optionalLoginMiddleware(request, response, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(response.statusCode, 200);
  assert.equal(request.userId, undefined);
});
