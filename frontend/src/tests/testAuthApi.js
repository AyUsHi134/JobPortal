// Deterministic verification for frontend/src/services/authApi.js
// (Phase 2B): correct endpoint, correct request body, correct success
// response, correct error handling for both login and signup — compared
// directly against BACKEND_API_CONTRACT.md §1. No real network call is
// made (a mocked axios adapter, per the same technique as
// testApiService.js). Run via `node src/tests/testAuthApi.js`.

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const { apiClient, ApiError } = await import("../services/api.js");
const { login, signup } = await import("../services/authApi.js");

let passCount = 0;
let failCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}

function mockAdapter({ status = 200, data = {} } = {}, captureConfig) {
  return async (config) => {
    if (captureConfig) captureConfig(config);
    return { data, status, statusText: "", headers: {}, config, request: {} };
  };
}

function mockFailureAdapter({ status, data }) {
  return async (config) => {
    const error = new Error("Request failed");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status, data, headers: {}, config };
    throw error;
  };
}

console.log("============================");
console.log(" AUTH API — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] login() calls the correct endpoint with the correct body");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { token: "fake.jwt.token", user: { name: "Asha", email: "asha@example.com" } } },
    (config) => { captured = config; }
  );

  const result = await login("asha@example.com", "correct-password");

  check("POST method used", captured.method === "post");
  check("the correct path — /api/auth/login, matching BACKEND_API_CONTRACT.md §1 (not the old /api/login)", captured.url === "/api/auth/login");
  check("the request body contains exactly {email, password}", captured.data === JSON.stringify({ email: "asha@example.com", password: "correct-password" }));
  check("the returned token is passed through", result.token === "fake.jwt.token");
  check("the returned user object is passed through", result.user.name === "Asha" && result.user.email === "asha@example.com");
}

// ---------------------------------------------------------------------------
console.log("\n[2] login() never logs the password anywhere");
{
  const originalLog = console.log;
  const originalError = console.error;
  const captured = [];
  console.log = (...a) => captured.push(a.join(" "));
  console.error = (...a) => captured.push(a.join(" "));

  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { token: "x", user: { name: "A", email: "a@x.com" } } });
  await login("a@x.com", "s3cr3t-plaintext-password");

  console.log = originalLog;
  console.error = originalError;

  check("the plaintext password never appears in any log output produced by login()", !captured.some((line) => line.includes("s3cr3t-plaintext-password")));
}

// ---------------------------------------------------------------------------
console.log("\n[3] login() failure surfaces the backend's real message safely (the msg-vs-message audit finding)");
{
  // BACKEND_API_CONTRACT.md §1: login failures use {msg: "Invalid credentials"}
  // — FRONTEND_AUDIT.md §5 found the old Login.jsx read `data.message`
  // (always undefined) instead. The centralized ApiError normalizer
  // fixes this class of bug once, for every caller.
  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { msg: "Invalid credentials" } });

  let thrown = null;
  try {
    await login("nobody@example.com", "wrong");
  } catch (err) {
    thrown = err;
  }

  check("login() rejects with an ApiError", thrown instanceof ApiError);
  check("the real backend message ('Invalid credentials') is surfaced, not a generic fallback", thrown.message === "Invalid credentials");
  check("the 401 status is preserved", thrown.status === 401);
}

// ---------------------------------------------------------------------------
console.log("\n[4] signup() calls the correct endpoint with the correct body");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 201, data: { msg: "User created" } }, (config) => {
    captured = config;
  });

  const result = await signup("Dee", "dee@example.com", "a-real-password");

  check("POST method used", captured.method === "post");
  check("the correct path — /api/auth/signup, matching BACKEND_API_CONTRACT.md §1", captured.url === "/api/auth/signup");
  check("the request body contains exactly {name, email, password}", captured.data === JSON.stringify({ name: "Dee", email: "dee@example.com", password: "a-real-password" }));
  check("the success response is passed through", result.msg === "User created");
}

// ---------------------------------------------------------------------------
console.log("\n[5] signup() failure (duplicate email) surfaces the correct message");
{
  apiClient.defaults.adapter = mockFailureAdapter({ status: 400, data: { msg: "User already exists" } });

  let thrown = null;
  try {
    await signup("Dee", "taken@example.com", "whatever");
  } catch (err) {
    thrown = err;
  }

  check("signup() rejects with an ApiError", thrown instanceof ApiError);
  check("the real backend message is surfaced", thrown.message === "User already exists");
  check("the 400 status is preserved", thrown.status === 400);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
