// API client verification, no network

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

// Dynamic import after fake localStorage
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

function mockFailureAdapter({ status, data, headers = {} } = {}) {
  return async (config) => {
    const error = new Error("Request failed");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status, data, headers, config };
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
  // Fallback default without Vite env
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

  // Malformed value must not crash
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
  // Only safe message key surfaced
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

  // Network failure yields generic message
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

// 429 plain-text body handling
console.log("\n[10] A 429 (rate limited) response gets a specific, non-generic message — status and Retry-After are read, no retry is attempted automatically");
{
  // Real rate-limit response shape
  apiClient.defaults.adapter = mockFailureAdapter({
    status: 429,
    data: "Too many requests, please try again later.",
    headers: { "retry-after": "42" },
  });
  let thrown = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    thrown = err;
  }
  check("the request rejected with an ApiError", thrown instanceof ApiError);
  check("the ApiError carries the 429 status (never hidden)", thrown.status === 429);
  check("the message is specific to rate limiting, not the generic fallback", thrown.message !== "Something went wrong. Please try again.");
  check("the message includes the real Retry-After wait time", thrown.message.includes("42"));
  check("no `retryAfter`/extra field was added to the error's own enumerable shape — {name, status, details} stays exact, same as every other error", Object.keys(thrown).sort().join(",") === "details,name,status");

  // Missing Retry-After still specific
  apiClient.defaults.adapter = mockFailureAdapter({ status: 429, data: "Too many requests, please try again later.", headers: {} });
  let thrownNoHeader = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    thrownNoHeader = err;
  }
  check("without a Retry-After header, the message is still rate-limit-specific (not generic, not fabricated)", thrownNoHeader.message !== "Something went wrong. Please try again." && !/NaN/.test(thrownNoHeader.message));

  // Future JSON 429 respected
  apiClient.defaults.adapter = mockFailureAdapter({ status: 429, data: { error: "Slow down, friend." }, headers: { "retry-after": "5" } });
  let thrownJsonBody = null;
  try {
    await apiClient.get("/api/jobs");
  } catch (err) {
    thrownJsonBody = err;
  }
  check("a real backend-supplied JSON message on a 429 is still preferred over the generic rate-limit copy", thrownJsonBody.message === "Slow down, friend.");
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
