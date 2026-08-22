// Deterministic verification for frontend/src/services/userApi.js
// (Phase 2B): profile, save-job, and is-saved API functions — compared
// directly against BACKEND_API_CONTRACT.md §6-§7. Critically verifies
// that these calls never send a client-supplied user id (the backend
// derives the acting user purely from the Authorization header the
// centralized apiClient attaches — PHASE_1I4_REPORT.md's own
// impersonation fix) and that no `unsaveJob` function exists, since the
// backend contract has no corresponding endpoint (a documented gap, not
// an oversight — see PHASE_2B_REPORT.md). No real network call is made.
// Run via `node src/tests/testUserApi.js`.

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const { apiClient, setStoredAuth, clearStoredAuth } = await import("../services/api.js");
const userApi = await import("../services/userApi.js");
const { getProfile, updateProfile, saveJob, isJobSaved } = userApi;

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

// A custom axios adapter must explicitly reject for a non-2xx response —
// unlike the real http/xhr adapters, it does not happen automatically
// just by setting `status` on a resolved value (those built-in adapters
// call axios's internal `settle()`, which this test deliberately doesn't
// depend on). Used for every "the backend responded with an error status"
// scenario.
function mockFailureAdapter({ status, data } = {}, captureConfig) {
  return async (config) => {
    if (captureConfig) captureConfig(config);
    const error = new Error("Request failed");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status, data, headers: {}, config };
    throw error;
  };
}

const JOB_ID = "60f7c2b5c1234567890000aa";

console.log("============================");
console.log(" USER/PROFILE/SAVE-JOB API — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] getProfile() calls GET /api/user/profile as an authenticated request");
{
  setStoredAuth("real-token", { name: "Asha", email: "asha@example.com" });
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { _id: "u1", name: "Asha", email: "asha@example.com", savedJobs: [] } },
    (config) => { captured = config; }
  );

  const profile = await getProfile();

  check("GET method used", captured.method === "get");
  check("the correct path", captured.url === "/api/user/profile");
  check("the Authorization header was attached automatically (no manual token handling needed by this function)", captured.headers.Authorization === "Bearer real-token");
  check("the bare user object is returned as-is (no {success,data} wrapper to unwrap for this endpoint)", profile.name === "Asha");
  check("no password field is present (the backend already excludes it — this layer doesn't need to filter anything)", !("password" in profile));
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[2] updateProfile() puts to /api/user/profile with only the given fields");
{
  setStoredAuth("real-token", { name: "Asha", email: "asha@example.com" });
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { _id: "u1", name: "Asha B.", email: "asha@example.com", savedJobs: [] } },
    (config) => { captured = config; }
  );

  const updated = await updateProfile({ name: "Asha B." });

  check("PUT method used", captured.method === "put");
  check("the correct path", captured.url === "/api/user/profile");
  check("only the requested field was sent in the body", captured.data === JSON.stringify({ name: "Asha B." }));
  check("the updated user is returned", updated.name === "Asha B.");
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[3] saveJob() sends ONLY {jobId} — never a client-supplied user id");
{
  setStoredAuth("real-token", { name: "Asha", email: "asha@example.com" });
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { success: true, savedJobs: [JOB_ID] } },
    (config) => { captured = config; }
  );

  const savedJobs = await saveJob(JOB_ID);

  check("POST method used", captured.method === "post");
  check("the correct path", captured.url === "/api/user/savejob");
  check("the request body is exactly {jobId} — no userId field anywhere", captured.data === JSON.stringify({ jobId: JOB_ID }));
  check("the Authorization header carries the identity instead", captured.headers.Authorization === "Bearer real-token");
  check("the updated savedJobs list is returned", Array.isArray(savedJobs) && savedJobs[0] === JOB_ID);
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[4] isJobSaved() sends ONLY {jobId} — never a client-supplied user id");
{
  setStoredAuth("real-token", { name: "Asha", email: "asha@example.com" });
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { isSaved: true } }, (config) => {
    captured = config;
  });

  const saved = await isJobSaved(JOB_ID);

  check("POST method used", captured.method === "post");
  check("the correct path", captured.url === "/api/user/issaved");
  check("the request body is exactly {jobId}", captured.data === JSON.stringify({ jobId: JOB_ID }));
  check("the boolean result is returned directly", saved === true);
  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[5] Save-job/profile requests made while logged out carry no Authorization header (the backend will correctly 401 them)");
{
  clearStoredAuth();
  let captured = null;
  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { message: "No token, auth denied" } }, (config) => {
    captured = config;
  });

  let thrown = null;
  try {
    await saveJob(JOB_ID);
  } catch (err) {
    thrown = err;
  }

  check("no Authorization header was sent", !captured.headers || captured.headers.Authorization === undefined);
  check("the 401 is surfaced to the caller as a normal, catchable error", thrown && thrown.status === 401);
}

// ---------------------------------------------------------------------------
console.log("\n[6] No unsaveJob function exists — the backend contract has no corresponding endpoint");
{
  // This is intentional, not an oversight: BACKEND_API_CONTRACT.md §6
  // only documents POST /api/user/savejob and POST /api/user/issaved.
  // Asserting its absence here makes the gap an explicit, checked fact
  // rather than a silent omission that could be "fixed" by accident
  // later by pointing it at a URL that doesn't exist.
  check("userApi.js does not export an unsaveJob function", typeof userApi.unsaveJob === "undefined");
  check("userApi.js does not export a removeJob/removeSavedJob function either", typeof userApi.removeSavedJob === "undefined" && typeof userApi.removeJob === "undefined");
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
