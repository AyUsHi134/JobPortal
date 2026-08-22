// Deterministic, static verification for the Phase 2G-5 Forgot Password
// page. This phase's audit (see PHASE_2G5_REPORT.md) found the page was
// a pure client-side mock — `setSent(true)` fired unconditionally on
// submit, no network request was ever made, and no backend endpoint has
// ever existed for it. The fix was to stop the page from claiming an
// email was sent, not to fabricate a working request/response cycle
// against a backend that has no such endpoint. These tests guard that
// honesty property: no fake success state, no network call, a clear
// path back to the one real, working auth flow (Login). Run via
// `node src/tests/testForgotPassword.js`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "..");
function readSource(relPath) {
  return fs.readFileSync(path.join(SRC_DIR, relPath), "utf8");
}

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

console.log("============================");
console.log(" FORGOT PASSWORD PAGE — DETERMINISTIC STATIC VERIFICATION TESTS (Phase 2G-5)");
console.log("============================");

const PAGE = readSource("pages/ForgotPassword.jsx");

// ---------------------------------------------------------------------------
console.log("\n[1] The page renders and carries a clear, on-theme heading (item 1)");
{
  check("a 'Forgot Password' heading is present", /Forgot Password/.test(PAGE));
  check("the heading reads the shared green theme via color=\"primary\" (not a hardcoded hex)", /color="primary"/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[2] The old, always-false 'email sent' success claim is gone — this phase's core fix (IMPORTANT FINAL RULE)");
{
  check("the literal old success text is no longer present anywhere", !/If the email exists, a reset link has been sent\./.test(PAGE));
  check("no text anywhere claims an email was sent/delivered", !/email (has been|was) sent/i.test(PAGE) && !/reset link has been sent/i.test(PAGE));
  check("the page no longer holds a 'sent'/success boolean state used to fake a completed action", !/\[sent, setSent\]/.test(PAGE) && !/setSent/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[3] No fake request-a-reset form remains — there is nothing real for it to submit to, so none is simulated");
{
  check("no <form> exists on this page", !/<form/i.test(PAGE));
  check("no email TextField/input exists (nothing is collected that can't be used)", !/type="email"/.test(PAGE) && !/label="Email"/.test(PAGE));
  check("no 'Send Reset Link' (or similarly action-implying) submit control exists", !/Send Reset Link/.test(PAGE));
  check("no onSubmit handler exists", !/onSubmit/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[4] No network call of any kind is made from this page (items 4, 16 — there is no real endpoint to call)");
{
  check("does not import anything from services/authApi.js", !/from ["'].*services\/authApi\.js["']/.test(PAGE));
  check("does not import the centralized apiClient directly either", !/from ["'].*services\/api\.js["']/.test(PAGE));
  check("no direct fetch(...) call exists", !/\bfetch\(/.test(PAGE));
  check("no direct axios usage exists", !/\baxios\b/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[5] No loading/disabled-submit state exists (item 6) — there is no request in flight to guard against duplicating, since none is ever sent");
{
  check("no isSubmitting/loading state was fabricated for a request that doesn't exist", !/isSubmitting|isLoading/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[6] The real limitation is stated honestly, in plain language, without fabricating a support channel that doesn't exist");
{
  check("clearly states self-service reset isn't available", /isn't available yet|is not available/i.test(PAGE));
  check("clearly states no email-sending capability is configured (the real, verified root cause)", /no email-sending capability/i.test(PAGE));
  check("does not invent a specific fake support email address or external contact form", !/@jobportal|support@|mailto:/i.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[7] Clear, working navigation back to the one real, functional login flow exists (item 'useful navigation back to Login')");
{
  check("imports Link from react-router-dom", /import \{ Link \} from ["']react-router-dom["']/.test(PAGE));
  check("a real router Link/Button targets /login", /to="\/login"/.test(PAGE));
  check("the control has a clear, honest label", /Back to Login/.test(PAGE));
}

// ---------------------------------------------------------------------------
console.log("\n[8] No alert(), and nothing sensitive is ever logged (items 'no alert()', 9, 10, 11 — vacuously true here, since there is no password/token/JWT value anywhere on this page to log; verified, not just assumed)");
{
  check("no alert(...) call exists", !/\balert\(/.test(PAGE));
  check("no console.log/console.error/console.warn/console.info/console.debug call of any kind exists on this page", !/console\.(log|error|warn|info|debug)/.test(PAGE));
  check("the page holds no password/token/JWT-shaped variable at all (no state, no request payload) — there is nothing sensitive for it to log", !/useState/.test(PAGE));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
