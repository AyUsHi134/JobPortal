// Deterministic verification for the Phase 2B centralized HTTP client
// (frontend/src/services/api.js): base URL configuration, token storage,
// the request interceptor's Authorization-header attachment, the
// response interceptor's 401 handling, and safe error normalization.
//
// No test framework/dependency is added — this mirrors the backend's own
// established testing convention (plain Node scripts with a small
// check() helper), run directly via `node src/tests/testApiService.js`.
// No real network call is ever made: axios's own `adapter` override
// mechanism (a stable, documented axios feature) replaces the actual
// HTTP transport with a deterministic canned response/error, while the
// REAL request/response interceptors still run around it — so this
// exercises the actual production interceptor code, not a reimplemented
// mock of it.
//
// `localStorage` doesn't exist in plain Node, so a minimal in-memory
// stand-in is installed on `globalThis` BEFORE api.js is imported
// (dynamic `import()`, not a static import, so ordering is guaranteed —
// see the comment below).

function createFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

globalThis.localStorage = createFakeLocalStorage();

// Static imports are resolved before any of this file's own top-level
// code runs, so the fake localStorage above MUST be installed via a
// dynamic import (a plain function call, evaluated in place) rather than
// a static `import` statement, or api.js's module body could observe an
// undefined `localStorage`.
const { apiClient, getStoredAuth, setStoredAuth, clearStoredAuth, getToken, onUnauthorized, ApiError, API_BASE_URL } =
  await import("../services/api.js");

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

function mockSuccessAdapter({ status = 200, data = {} } = {}, captureConfig) {
  return async (config) => {
    if (captureConfig) captureConfig(config);
    return { data, status, statusText: "", headers: {}, config, request: {} };
  };
}

function mockFailureAdapter({ status, data } = {}) {
  return async (config) => {
    const error = new Error("Request failed");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status, data, headers: {}, config };
    throw error;
  };
}

console.log("============================");
console.log(" FRONTEND API CLIENT — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] API_BASE_URL falls back to the documented default outside Vite");
{
  // In this plain-Node context, import.meta.env is undefined, so the
  // fallback default must be used — proving the config doesn't crash or
  // silently resolve to "undefined" when VITE_API_URL isn't injected.
  check("API_BASE_URL is the documented localhost default", API_BASE_URL === "http://localhost:5000");
  check("apiClient's baseURL matches", apiClient.defaults.baseURL === "http://localhost:5000");
}

// ---------------------------------------------------------------------------
console.log("\n[2] Auth storage: set / get / clear round-trip, never throws on garbage input");
{
  clearStoredAuth();
  check("no stored auth initially", getStoredAuth() === null);
  check("getToken() is null when logged out", getToken() === null);

  setStoredAuth("fake.jwt.token", { name: "Asha", email: "asha@example.com" });
  const stored = getStoredAuth();
  check("token round-trips correctly", stored.token === "fake.jwt.token");
  check("user round-trips correctly", stored.user.name === "Asha" && stored.user.email === "asha@example.com");
  check("getToken() reflects the stored token", getToken() === "fake.jwt.token");

  clearStoredAuth();
  check("auth is cleared after clearStoredAuth()", getStoredAuth() === null);

  // A malformed/legacy stored value must never crash the app.
  localStorage.setItem("jobportal_auth", "{not valid json");
  check("malformed stored JSON is treated as logged-out, not a crash", getStoredAuth() === null);
  localStorage.setItem("jobportal_auth", JSON.stringify({ user: { name: "no token here" } }));
  check("a stored value with no token is treated as logged-out", getStoredAuth() === null);
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[3] Request interceptor attaches Authorization: Bearer <token> when logged in");
{
  setStoredAuth("real-session-token", { name: "Bo", email: "bo@example.com" });
  let capturedConfig = null;
  apiClient.defaults.adapter = mockSuccessAdapter({ status: 200, data: { ok: true } }, (config) => {
    capturedConfig = config;
  });

  await apiClient.get("/api/jobs");

  check("the Authorization header was attached", capturedConfig.headers.Authorization === "Bearer real-session-token");
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[4] Request interceptor sends NO Authorization header when logged out (no fake header)");
{
  clearStoredAuth();
  let capturedConfig = null;
  apiClient.defaults.adapter = mockSuccessAdapter({ status: 200, data: {} }, (config) => {
    capturedConfig = config;
  });

  await apiClient.get("/api/jobs");

  check("no Authorization header is present at all", !capturedConfig.headers || capturedConfig.headers.Authorization === undefined);
}

// ---------------------------------------------------------------------------
console.log("\n[5] A 401 response clears stored auth and notifies subscribers, without redirecting");
{
  setStoredAuth("soon-to-expire-token", { name: "Cy", email: "cy@example.com" });
  let notified = false;
  const unsubscribe = onUnauthorized(() => {
    notified = true;
  });

  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { message: "Token is not valid" } });

  let thrown = null;
  try {
    await apiClient.get("/api/user/profile");
  } catch (err) {
    thrown = err;
  }

  check("the request rejected with an ApiError", thrown instanceof ApiError);
  check("the ApiError carries the 401 status", thrown.status === 401);
  check("stored auth was cleared", getStoredAuth() === null);
  check("the onUnauthorized subscriber was notified", notified === true);
  unsubscribe();
}

// ---------------------------------------------------------------------------
console.log("\n[6] onUnauthorized unsubscribe actually stops future notifications");
{
  let callCount = 0;
  const unsubscribe = onUnauthorized(() => {
    callCount++;
  });
  unsubscribe();

  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { message: "Token is not valid" } });
  try {
    await apiClient.get("/api/user/profile");
  } catch {
    // expected
  }
  check("the unsubscribed listener was never called", callCount === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[7] Error normalization extracts the right message across all three backend error-key conventions");
{
  const cases = [
    { data: { error: "Invalid job ID." }, expected: "Invalid job ID." },
    { data: { msg: "Invalid credentials" }, expected: "Invalid credentials" },
    { data: { message: "No token, auth denied" }, expected: "No token, auth denied" },
    { data: {}, expected: "Something went wrong. Please try again." },
  ];
  for (const { data, expected } of cases) {
    apiClient.defaults.adapter = mockFailureAdapter({ status: 400, data });
    let thrown = null;
    try {
      await apiClient.get("/api/jobs/whatever");
    } catch (err) {
      thrown = err;
    }
    check(`extracts "${expected}" from ${JSON.stringify(data)}`, thrown.message === expected);
  }
}

// ---------------------------------------------------------------------------
console.log("\n[8] Error normalization never leaks raw error internals to the caller");
{
  // Simulates a hypothetical backend response that (incorrectly) included
  // extra internal detail alongside its safe error message — proving the
  // normalizer only ever surfaces the one recognized safe-message key,
  // never the whole response body.
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  apiClient.defaults.adapter = mockFailureAdapter({
    status: 500,
    data: { error: "Failed to retrieve jobs. Please try again later.", stack: SENSITIVE, rawMongoError: SENSITIVE },
  });
  let thrown = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    thrown = err;
  }
  check("only the backend's own safe message is exposed", thrown.message === "Failed to retrieve jobs. Please try again later.");
  check("the sensitive extra fields never appear in the normalized error's message", !thrown.message.includes(SENSITIVE));
  check("the normalized error exposes only {name, status, details} as its own enumerable properties — no passthrough of the raw response body", Object.keys(thrown).sort().join(",") === "details,name,status");

  // A network failure (no response at all) must also produce a safe,
  // generic message — never the raw axios/Node error text (which can
  // include the request URL/host).
  apiClient.defaults.adapter = async () => {
    const error = new Error("connect ECONNREFUSED 127.0.0.1:5000");
    error.isAxiosError = true;
    error.request = {};
    throw error;
  };
  let networkErr = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    networkErr = err;
  }
  check("a network-level failure gets a safe, generic message (not the raw connection error text)", networkErr.message === "Could not reach the server. Please check your connection and try again.");
}

// ---------------------------------------------------------------------------
console.log("\n[9] Error `details` array (validation errors) is preserved when present");
{
  apiClient.defaults.adapter = mockFailureAdapter({
    status: 400,
    data: { success: false, error: "Invalid job data.", details: ["Path `title` is required."] },
  });
  let thrown = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    thrown = err;
  }
  check("details array is preserved", Array.isArray(thrown.details) && thrown.details[0] === "Path `title` is required.");
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
