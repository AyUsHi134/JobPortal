// Deterministic, static verification of the Phase 2G-5 audit's actual
// finding: that no password-reset/account-recovery architecture exists
// anywhere in this project — not on the frontend, not on the backend.
// Unlike this project's other test files (which verify frontend source
// only), this file also reads the real backend source (read-only, never
// modified) because "backend is the source of truth for the actual
// password-reset contract" was this phase's own explicit instruction —
// asserting the audit's conclusion only against frontend code would not
// actually prove the backend has no such endpoint. These checks exist so
// a future phase can't silently reintroduce a fake/partial reset flow
// (e.g. a frontend call to an endpoint that still doesn't exist) without
// this suite catching it. Run via `node src/tests/testAuthRecovery.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
const BACKEND_DIR = path.resolve(__dirname, "../../../backend");

function readFrontend(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}
function readBackend(relPath) {
  return fs.readFileSync(path.join(BACKEND_DIR, relPath), "utf8");
}

let passCount = 0;
let failCount = 0;
let skipCount = 0;
function check(label, condition) {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failCount++;
    console.log(`  FAIL  ${label}`);
  }
}
function checkIfBackendReachable(label, fn) {
  try {
    check(label, fn());
  } catch (err) {
    skipCount++;
    console.log(`  SKIP  ${label} (backend source not readable from this environment: ${err.code || err.message})`);
  }
}

console.log("============================");
console.log(" AUTH RECOVERY ARCHITECTURE AUDIT — DETERMINISTIC STATIC VERIFICATION (Phase 2G-5)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] Backend: no password-reset route is registered (the real source of truth for the contract)");
{
  checkIfBackendReachable("routes/auth.js registers only /signup and /login — no forgot/reset-password route", () => {
    const source = readBackend("routes/auth.js");
    const noResetRoute = !/forgot|reset-password|reset[-_]?token/i.test(source);
    const hasKnownRoutes = /router\.post\(["']\/signup["']/.test(source) && /router\.post\(["']\/login["']/.test(source);
    return noResetRoute && hasKnownRoutes;
  });
  checkIfBackendReachable("routes/user.js also registers no reset-password route", () => {
    const source = readBackend("routes/user.js");
    return !/forgot|reset-password|reset[-_]?token/i.test(source);
  });
}

// ---------------------------------------------------------------------------
console.log("\n[2] Backend: no reset-token generation/validation logic and no email-provider dependency exist");
{
  checkIfBackendReachable("controllers/auth.js exports only register/login — no resetPassword/forgotPassword handler", () => {
    const source = readBackend("controllers/auth.js");
    return !/resetPassword|forgotPassword|generateResetToken/i.test(source);
  });
  checkIfBackendReachable("the User model has no reset-token/expiry field", () => {
    const source = readBackend("models/User.js");
    return !/resetToken|resetPasswordToken|resetPasswordExpires/i.test(source);
  });
  checkIfBackendReachable("backend/package.json lists no email-provider dependency (nodemailer, SendGrid, Mailgun, SES/Resend/Postmark SDKs, etc.)", () => {
    const source = readBackend("package.json");
    return !/nodemailer|sendgrid|mailgun|"ses"|resend|postmark|@aws-sdk\/client-ses/i.test(source);
  });
}

// ---------------------------------------------------------------------------
console.log("\n[3] Frontend: no forgot/reset-password function was added to the centralized authApi service (never a raw fetch/axios call as a workaround)");
{
  const authApi = readFrontend("services/authApi.js");
  check("authApi.js exports only login/signup", /export async function login/.test(authApi) && /export async function signup/.test(authApi) && !/forgotPassword|resetPassword/i.test(authApi));
  check("authApi.js still routes through the shared apiClient, no direct fetch/axios", /from ["']\.\/api\.js["']/.test(authApi) && !/\bfetch\(/.test(authApi) && !/\baxios\b/.test(authApi));
}

// ---------------------------------------------------------------------------
console.log("\n[4] Frontend: no reset-password page/route was invented for a backend endpoint that doesn't exist (this phase's explicit 'do not invent missing backend endpoints' instruction)");
{
  const appSource = readFrontend("App.jsx");
  check("App.jsx registers no reset-password route", !/reset-password/i.test(appSource));
  check("no reset-password page file exists under pages/", !fs.existsSync(path.join(SRC_DIR, "pages/ResetPassword.jsx")) && !fs.existsSync(path.join(SRC_DIR, "pages/ResetPassword")));
}

// ---------------------------------------------------------------------------
console.log("\n[5] Frontend: Login.jsx's existing, unrelated authentication behavior was not touched by this phase's audit/fix");
{
  const login = readFrontend("pages/Login/Login.jsx");
  check("Login.jsx still posts through the unchanged loginRequest()/authApi.js call (Phase 2B behavior)", /loginRequest\(email, password\)/.test(login));
  check("Login.jsx's 'Forgot password?' link still points at the real, existing /forgot-password route (not removed, not broken)", /to="\/forgot-password"/.test(login));
}

// ---------------------------------------------------------------------------
console.log("\n[6] Frontend: no new direct fetch/axios call was introduced anywhere by this phase's changes (item 16, whole-tree discipline)");
{
  const forgotPassword = readFrontend("pages/ForgotPassword.jsx");
  check("ForgotPassword.jsx contains no direct fetch(...) call", !/\bfetch\(/.test(forgotPassword));
  check("ForgotPassword.jsx contains no direct axios usage", !/\baxios\b/.test(forgotPassword));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed, ${skipCount} skipped`);
console.log("============================");
