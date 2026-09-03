// Deterministic verification for frontend/src/utils/savedJobUi.js
// (Phase 2E): the pure Save-button decision logic JobCard.jsx and
// JobDetail.jsx both render through, and the pure "trust the backend's
// real savedJobs list" check used after a save request resolves. No
// React rendering, no network — these are the exact functions the
// components call, so testing them directly is testing the actual
// button-state decisions. Run via `node src/tests/testSavedJobUi.js`.

import { getSaveButtonState, resolveSavedStateAfterSave, resolveSavedStateAfterUnsave } from "../utils/savedJobUi.js";

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
console.log(" SAVED-JOB UI DECISION LOGIC — DETERMINISTIC TESTS");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] getSaveButtonState — logged-out user gets a login-required affordance, never a doomed request");
{
  const state = getSaveButtonState({ isAuthenticated: false, isSaved: false, isSaving: false });
  check("label reads 'Log in to Save'", state.label === "Log in to Save");
  check("the button stays clickable (navigates to /login instead of being inert)", state.disabled === false);
  check("action is 'login', not 'save' — the caller must not attempt POST /api/user/savejob", state.action === "login");
}

// ---------------------------------------------------------------------------
console.log("\n[2] getSaveButtonState — logged-out state wins even if isSaved/isSaving were somehow true (defensive precedence)");
{
  const state = getSaveButtonState({ isAuthenticated: false, isSaved: true, isSaving: true });
  check("still resolves to the login-required state", state.action === "login" && state.label === "Log in to Save");
}

// ---------------------------------------------------------------------------
console.log("\n[3] getSaveButtonState — a save in flight disables the button, preventing a duplicate request");
{
  const state = getSaveButtonState({ isAuthenticated: true, isSaved: false, isSaving: true });
  check("label reads 'Saving...'", state.label === "Saving...");
  check("disabled while in flight", state.disabled === true);
  check("action is 'none' — a click must not fire a second request", state.action === "none");
}

// ---------------------------------------------------------------------------
console.log("\n[4] getSaveButtonState — an already-saved job is an enabled 'Saved' state that triggers unsave on click");
{
  const state = getSaveButtonState({ isAuthenticated: true, isSaved: true, isSaving: false });
  check("label reads 'Saved'", state.label === "Saved");
  check("enabled — clicking it fires the real unsave request", state.disabled === false);
  check("action is 'unsave'", state.action === "unsave");
}

// ---------------------------------------------------------------------------
console.log("\n[5] getSaveButtonState — the real, actionable case: authenticated, not yet saved, not in flight");
{
  const state = getSaveButtonState({ isAuthenticated: true, isSaved: false, isSaving: false });
  check("label reads 'Save'", state.label === "Save");
  check("enabled", state.disabled === false);
  check("action is 'save' — only this exact combination triggers the real request", state.action === "save");
}

// ---------------------------------------------------------------------------
console.log("\n[6] resolveSavedStateAfterSave — trusts the backend's real savedJobs list, never assumes success blindly");
{
  check(
    "the just-saved job id is present in the returned list -> true",
    resolveSavedStateAfterSave("job-1", ["job-1", "job-2"]) === true
  );
  check(
    "the just-saved job id is NOT present in the returned list -> false (a real, honest signal something didn't record)",
    resolveSavedStateAfterSave("job-3", ["job-1", "job-2"]) === false
  );
  check("an empty returned list -> false", resolveSavedStateAfterSave("job-1", []) === false);
  check("a non-array response (defensive) -> true (a non-throwing response is trusted as success)", resolveSavedStateAfterSave("job-1", undefined) === true);
}

// ---------------------------------------------------------------------------
console.log("\n[7] resolveSavedStateAfterUnsave — trusts the backend's real savedJobs list, never assumes success blindly");
{
  check(
    "the just-unsaved job id is ABSENT from the returned list -> false (isSaved is now false)",
    resolveSavedStateAfterUnsave("job-1", ["job-2"]) === false
  );
  check(
    "the just-unsaved job id is STILL present in the returned list -> true (an honest signal the removal didn't actually record)",
    resolveSavedStateAfterUnsave("job-1", ["job-1", "job-2"]) === true
  );
  check("an empty returned list -> false", resolveSavedStateAfterUnsave("job-1", []) === false);
  check("a non-array response (defensive) -> false (a non-throwing response is trusted as success, i.e. no longer saved)", resolveSavedStateAfterUnsave("job-1", undefined) === false);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
