// Pure, framework-free fetch-lifecycle state machine for the Job Detail
// page (JobDescription.jsx). Mirrors utils/jobDiscoveryState.js's
// discoveryReducer pattern (Phase 2C) so the "loading -> success/not-
// found/invalid-id/error" transitions — and specifically "a fresh
// FETCH_START always clears any previously loaded job before the new
// request resolves, so a previous job's data is never presented as
// belonging to a new id" — are independently unit-testable without any
// React rendering. See src/tests/testJobDetailStates.js.

export const JOB_DETAIL_STATUS = {
  LOADING: "loading",
  SUCCESS: "success",
  NOT_FOUND: "not_found",
  INVALID_ID: "invalid_id",
  ERROR: "error",
};

/**
 * Classifies a normalized ApiError (services/api.js) from
 * `jobsApi.getJobById()` into one of the detail-page's distinct states.
 * `404` (BACKEND_API_CONTRACT.md §4 — nonexistent OR inactive job,
 * identically) becomes NOT_FOUND; `400` (malformed id) becomes
 * INVALID_ID, so the UI can give a slightly more accurate message
 * without ever distinguishing "nonexistent" from "inactive" (the backend
 * itself never reveals that distinction). Anything else (500, network
 * failure, unexpected status) becomes the generic ERROR state.
 */
export function classifyJobDetailError(error) {
  const status = error?.status;
  if (status === 404) return JOB_DETAIL_STATUS.NOT_FOUND;
  if (status === 400) return JOB_DETAIL_STATUS.INVALID_ID;
  return JOB_DETAIL_STATUS.ERROR;
}

export function getInitialJobDetailState() {
  return { status: JOB_DETAIL_STATUS.LOADING, job: null, message: null };
}

export function jobDetailReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      // Always resets `job` to null — a slow, superseded request for a
      // previously viewed id can never leave stale data on screen for a
      // newly requested id (the component also cancellation-guards the
      // async call itself; this is the state-shape half of that guarantee).
      return { status: JOB_DETAIL_STATUS.LOADING, job: null, message: null };
    case "FETCH_SUCCESS":
      return { status: JOB_DETAIL_STATUS.SUCCESS, job: action.job, message: null };
    case "FETCH_ERROR":
      return { status: classifyJobDetailError(action.error), job: null, message: action.error?.message || null };
    default:
      return state;
  }
}
