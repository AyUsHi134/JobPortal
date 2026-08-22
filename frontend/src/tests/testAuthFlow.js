// Deterministic + static verification for the Phase 2E authentication
// flow (signup/login/logout/AuthContext restoration/401 handling). The
// underlying login()/signup() request shapes and the token-storage
// primitives were already thoroughly covered in Phase 2B's
// testAuthApi.js/testApiService.js and are not re-tested here; this file
// covers what's specific to Phase 2E: the end-to-end
// "login -> token stored -> protected request authenticated -> 401
// clears it -> logout clears it" pipeline exercised through the real
// service functions, plus static proof that no password/token is ever
// logged and that Login.jsx/Signup.jsx/AuthContext.jsx actually wire
// together the way this phase requires. Run via
// `node src/tests/testAuthFlow.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");

const { apiClient, getStoredAuth, setStoredAuth, clearStoredAuth, getToken, onUnauthorized } = await import("../services/api.js");
const { login, signup } = await import("../services/authApi.js");
const { saveJob } = await import("../services/userApi.js");

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

function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

console.log("============================");
console.log(" AUTHENTICATION FLOW — DETERMINISTIC + STATIC VERIFICATION TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] End-to-end login flow: real login() response -> stored -> a subsequent protected request is authenticated");
{
  clearStoredAuth();
  apiClient.defaults.adapter = mockAdapter({
    status: 200,
    data: { token: "real-jwt-token", user: { name: "Ayushi", email: "ayushi@example.com" } },
  });

  const { token, user } = await login("ayushi@example.com", "correct-password");
  check("login() resolves with the real backend shape", token === "real-jwt-token" && user.name === "Ayushi");

  // This is exactly what AuthContext.login(token, user) does.
  setStoredAuth(token, user);
  check("the stored auth now reflects the logged-in session", getStoredAuth().token === "real-jwt-token" && getStoredAuth().user.email === "ayushi@example.com");

  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 200, data: { success: true, savedJobs: ["job-1"] } }, (config) => {
    captured = config;
  });
  await saveJob("job-1");
  check("a protected request made after login carries the real stored token automatically", captured.headers.Authorization === "Bearer real-jwt-token");

  clearStoredAuth();
}

// ---------------------------------------------------------------------------
console.log("\n[2] Failed login never stores anything and surfaces the backend's real, safe error message");
{
  clearStoredAuth();
  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { msg: "Invalid credentials" } });

  let thrown = null;
  try {
    await login("ayushi@example.com", "wrong-password");
  } catch (err) {
    thrown = err;
  }

  check("the real backend message surfaces (the msg-vs-message audit fix, Phase 2B)", thrown && thrown.message === "Invalid credentials");
  check("status is preserved for callers that want to branch on it", thrown.status === 401);
  check("nothing was ever stored on a failed login", getStoredAuth() === null);
}

// ---------------------------------------------------------------------------
console.log("\n[3] Signup never stores a token/password and matches the real backend contract");
{
  clearStoredAuth();
  let captured = null;
  apiClient.defaults.adapter = mockAdapter({ status: 201, data: { msg: "User created" } }, (config) => {
    captured = config;
  });

  const result = await signup("Ayushi", "ayushi@example.com", "s3cret-password");

  check("POST to the correct endpoint", captured.url === "/api/auth/signup");
  check("the request body carries exactly name/email/password, nothing extra", captured.data === JSON.stringify({ name: "Ayushi", email: "ayushi@example.com", password: "s3cret-password" }));
  check("the success response is returned as-is ({msg})", result.msg === "User created");
  check("signup alone never stores any auth state (it returns no token — nothing to store)", getStoredAuth() === null);
}

// ---------------------------------------------------------------------------
console.log("\n[4] A 401 on any protected request clears stale auth (Phase 2B behavior) — verified end-to-end through a real userApi call, not just the interceptor in isolation");
{
  setStoredAuth("expiring-token", { name: "Ayushi", email: "ayushi@example.com" });
  check("sanity: a session is stored beforehand", getStoredAuth() !== null);

  let notified = false;
  const unsubscribe = onUnauthorized(() => { notified = true; });

  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { message: "Token is not valid" } });

  let thrown = null;
  try {
    await saveJob("job-1");
  } catch (err) {
    thrown = err;
  }

  check("the 401 is surfaced to the caller as a normal, catchable error", thrown && thrown.status === 401);
  check("stale auth was cleared as a direct result of the 401 (this is what lets AuthContext/JobCard/JobDetail/SavedJobs/Profile all react)", getStoredAuth() === null);
  check("the onUnauthorized subscriber (what AuthContext registers) was actually notified", notified === true);

  unsubscribe();
}

// ---------------------------------------------------------------------------
console.log("\n[5] Logout is exactly clearStoredAuth() — verified it fully removes the session, matching AuthContext.logout()'s implementation");
{
  setStoredAuth("some-token", { name: "Ayushi", email: "ayushi@example.com" });
  check("sanity: logged in beforehand", getToken() === "some-token");

  clearStoredAuth();

  check("no token remains after logout", getToken() === null);
  check("no stored auth object remains after logout", getStoredAuth() === null);

  let captured = null;
  apiClient.defaults.adapter = mockFailureAdapter({ status: 401, data: { message: "No token, auth denied" } }, (config) => { captured = config; });
  let thrown = null;
  try { await saveJob("job-1"); } catch (err) { thrown = err; }
  check("a request made after logout carries no Authorization header at all", !captured.headers || captured.headers.Authorization === undefined);
  check("the backend's real 401 is what the UI would see, not a client-side guess", thrown.status === 401);
}

// ---------------------------------------------------------------------------
console.log("\n[6] AuthContext restores authentication from storage synchronously on startup (no async initialization gap)");
{
  const source = readSource("context/AuthContext.jsx");
  check("reads getStoredAuth() directly as the initial useState value — restored before the very first render, not after an effect", /useState\(\(\) => getStoredAuth\(\)\)/.test(source));
  check("login() stores the token via setStoredAuth before updating React state", /setStoredAuth\(token, user\)/.test(source));
  check("logout() clears storage via clearStoredAuth()", /clearStoredAuth\(\)/.test(source));
  check("no refresh-token logic exists (this phase explicitly forbids adding any — the backend contract offers none)", !/refresh.?token/i.test(source));
  check("subscribes to onUnauthorized so a 401 elsewhere in the app clears React state too", /onUnauthorized\(/.test(source));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Login.jsx/Signup.jsx never log the password or the JWT anywhere");
{
  for (const [label, relPath] of [["Login.jsx", "pages/Login/Login.jsx"], ["Signup.jsx", "pages/Signup.jsx"]]) {
    const source = readSource(relPath);
    const consoleCalls = source.match(/console\.\w+\([^)]*\)/g) || [];
    const leaksSensitiveData = consoleCalls.some((call) => /password|token/i.test(call));
    check(`${label} has no console.* call mentioning password/token`, !leaksSensitiveData);
  }
  // Repository-wide sweep, mirroring PHASE_2B_REPORT.md §3's own check —
  // re-confirmed here since this phase touches the auth pages directly.
  function walk(dir, files = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, files);
      else if (/\.jsx?$/.test(entry.name) && !full.includes(`${path.sep}tests${path.sep}`)) files.push(full);
    }
    return files;
  }
  let offenders = [];
  for (const file of walk(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    const consoleCalls = source.match(/console\.\w+\([^)]*\)/g) || [];
    if (consoleCalls.some((call) => /password|token/i.test(call))) offenders.push(path.relative(SRC_DIR, file));
  }
  check("no application-source file logs password/token anywhere", offenders.length === 0);
}

// ---------------------------------------------------------------------------
console.log("\n[8] Login.jsx correctly wires authApi.login() into AuthContext.login(token, user) and shows a safe error on failure");
{
  const source = readSource("pages/Login/Login.jsx");
  check("destructures {token, user} from the real login request", /const \{ token, user \} = await loginRequest\(/.test(source));
  check("calls the AuthContext login(token, user) — never just a user object", /login\(token, user\)/.test(source));
  check("failure is shown via the caught error's own .message (the normalized ApiError), never a raw object", /err\.message/.test(source));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
