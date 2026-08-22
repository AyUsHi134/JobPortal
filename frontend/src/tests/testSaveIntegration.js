// Deterministic + static verification that JobCard.jsx (Phase 2C) and
// JobDetail.jsx (Phase 2D) both integrate the Phase 2E saved-job state
// through the SAME shared hook/helper pair — hooks/useSavedJobState.js +
// utils/savedJobUi.js#getSaveButtonState — rather than each
// reimplementing its own fetch/save logic. Also verifies the concrete
// UX requirements this phase calls out for both: no client-supplied
// user id is ever sent, no internal user id is ever rendered, a
// logged-out click no longer fires a blocking alert(), and a save
// failure is shown as safe inline text. Run via
// `node src/tests/testSaveIntegration.js`.

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
console.log(" JOBCARD / JOBDETAIL SAVE-STATE INTEGRATION — STATIC VERIFICATION TESTS");
console.log("============================");

const JOB_CARD = readSource("components/JobCard/JobCard.jsx");
const JOB_DETAIL = readSource("pages/JobDetail/JobDetail.jsx");
const HOOK = readSource("hooks/useSavedJobState.js");

// ---------------------------------------------------------------------------
console.log("\n[1] Both JobCard.jsx and JobDetail.jsx use the SAME shared hook and helper — no duplicated save-state logic");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} imports useSavedJobState from hooks/useSavedJobState.js`, /import \{ useSavedJobState \} from ["'].*hooks\/useSavedJobState\.js["']/.test(source));
    check(`${label} imports getSaveButtonState from utils/savedJobUi.js`, /import \{ getSaveButtonState \} from ["'].*utils\/savedJobUi\.js["']/.test(source));
    check(`${label} does not call userApi's saveJob/isJobSaved directly (that's the hook's job now)`, !/from ["'].*services\/userApi\.js["']/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[2] The shared hook itself never sends a client-supplied user id — identity is the JWT the apiClient attaches, always");
{
  check("useSavedJobState.js never constructs/sends a userId/ownerId of any kind", !/userId|ownerId/.test(HOOK));
  check("useSavedJobState.js calls saveJob(jobId)/isJobSaved(jobId) with only the job id, matching userApi.js's own {jobId}-only contract", /saveJob\(jobId\)/.test(HOOK) && /isJobSaved\(jobId\)/.test(HOOK));
}

// ---------------------------------------------------------------------------
console.log("\n[3] Neither JobCard.jsx nor JobDetail.jsx ever renders an internal user id");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} does not reference user._id/user.id anywhere`, !/user\._id|user\.id\b/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[4] A logged-out Save click no longer fires a blocking alert() — the button itself communicates the login requirement");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} contains no alert(...) call for the save flow`, !/\balert\(/.test(source));
    check(`${label} navigates to /login when the button's action is "login"`, /action === "login"[\s\S]{0,40}navigate\("\/login"\)/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[5] A save failure renders as safe inline text, not a blocking alert or a raw error object");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} renders the hook's error state inline`, /\{saveError &&/.test(source));
    check(`${label} does not render the raw error object directly (only its already-safe .message, via the hook)`, !/\{saveError\.message\}/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[6] Both use getSaveButtonState's label/disabled output directly — no separate hand-written 'Saved'/disabled logic reintroduced");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} renders saveButton.label`, /\{saveButton\.label\}/.test(source));
    check(`${label} uses saveButton.disabled for the button's disabled prop`, /disabled=\{saveButton\.disabled\}/.test(source));
  }
}

// ---------------------------------------------------------------------------
console.log("\n[7] Save-in-flight (isSaving) is available to and used by both, preventing accidental repeated requests");
{
  for (const [label, source] of [["JobCard.jsx", JOB_CARD], ["JobDetail.jsx", JOB_DETAIL]]) {
    check(`${label} destructures isSaving from useSavedJobState`, /isSaving/.test(source));
    check(`${label} passes isSaving into getSaveButtonState`, /getSaveButtonState\(\{[^}]*isSaving/.test(source));
  }
  check("the hook itself refuses to start a second save while one is already in flight", /if \(!isAuthenticated \|\| isSaved \|\| isSaving\) return;/.test(HOOK));
}

// ---------------------------------------------------------------------------
console.log("\n[8] JobDetail's Save action lives alongside Apply in the existing job-actions area — no separate, redundant section was invented");
{
  const actionsBlock = JOB_DETAIL.slice(JOB_DETAIL.indexOf('className="job-actions"'), JOB_DETAIL.indexOf('className="job-actions"') + 800);
  check("the Apply link and the Save button are both inside the same job-actions block", /apply-btn/.test(actionsBlock) && /save-btn/.test(actionsBlock));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
