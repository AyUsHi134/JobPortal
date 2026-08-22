// Pure, framework-free decision logic for the Save/Unsave button JobCard
// and JobDetail both render (Phase 2E). Kept side-effect-free — no React,
// no network — so the actual label/enabled/action decision is directly
// unit-testable without any component rendering, mirroring the same
// pattern established in utils/jobDiscoveryState.js (Phase 2C) and
// utils/jobDetailState.js (Phase 2D).
//
// There is deliberately no "unsave" action here: BACKEND_API_CONTRACT.md
// §6 only documents POST /api/user/savejob and POST /api/user/issaved —
// no remove-saved-job endpoint exists on the backend today (confirmed,
// not an oversight — see PHASE_2B_REPORT.md §5 and testUserApi.js [6]).
// Building a fake client-side "unsave" would either call a URL the
// backend doesn't implement or silently lie about the saved state until
// the next reload reverts it — both violate this project's established
// data-honesty rule. The "Saved" state is therefore always a disabled,
// terminal state once reached; a real unsave UI needs a new backend
// endpoint first (see PHASE_2E_REPORT.md's known limitations).

/**
 * @param {{isAuthenticated: boolean, isSaved: boolean, isSaving: boolean}} state
 * @returns {{label: string, disabled: boolean, action: "login"|"save"|"none"}}
 */
export function getSaveButtonState({ isAuthenticated, isSaved, isSaving }) {
  if (!isAuthenticated) {
    // A clear login-required affordance, not a request that's guaranteed
    // to fail: clicking navigates to /login instead of attempting
    // POST /api/user/savejob without a token.
    return { label: "Log in to Save", disabled: false, action: "login" };
  }
  if (isSaving) {
    // Disabled while a save request is in flight — prevents a rapid
    // double-click from firing two POST /api/user/savejob requests.
    return { label: "Saving...", disabled: true, action: "none" };
  }
  if (isSaved) {
    return { label: "Saved", disabled: true, action: "none" };
  }
  return { label: "Save", disabled: false, action: "save" };
}

/**
 * `POST /api/user/savejob` returns the caller's full, real updated
 * `savedJobs` id list (BACKEND_API_CONTRACT.md §6) — trusting that list
 * (rather than just assuming "the request didn't throw, so it must be
 * saved now") is what actually confirms this specific job is saved, and
 * avoids ever reporting a job as saved that the backend didn't actually
 * record. A non-array response (defensive — the documented contract
 * always returns an array) falls back to trusting a non-throwing
 * response as success rather than silently showing "unsaved" after a
 * request that didn't fail.
 */
export function resolveSavedStateAfterSave(jobId, savedJobIds) {
  return Array.isArray(savedJobIds) ? savedJobIds.includes(jobId) : true;
}
