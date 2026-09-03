// Pure, framework-free decision logic for the Save/Unsave button JobCard
// and JobDetail both render (Phase 2E). Kept side-effect-free — no React,
// no network — so the actual label/enabled/action decision is directly
// unit-testable without any component rendering, mirroring the same
// pattern established in utils/jobDiscoveryState.js (Phase 2C) and
// utils/jobDetailState.js (Phase 2D).

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
    // Enabled, not terminal: POST /api/user/unsavejob now exists, so a
    // saved job can be un-saved directly from the same button.
    return { label: "Saved", disabled: false, action: "unsave" };
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

/**
 * Same trust rule as resolveSavedStateAfterSave, applied to
 * `POST /api/user/unsavejob`'s response: returns the job's real `isSaved`
 * state by checking whether it's still present in the backend's returned
 * list, rather than assuming the removal worked just because the request
 * didn't throw. A non-array response (defensive) falls back to trusting a
 * non-throwing response as success — i.e. no longer saved.
 */
export function resolveSavedStateAfterUnsave(jobId, savedJobIds) {
  return Array.isArray(savedJobIds) ? savedJobIds.includes(jobId) : false;
}
