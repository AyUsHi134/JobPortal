// Deterministic verification for the Job Detail page's fetch-lifecycle
// state machine (frontend/src/utils/jobDetailState.js, Phase 2D):
// loading/success/not-found/invalid-id/error classification, and that a
// fresh FETCH_START always clears any previously loaded job (so a
// superseded request's stale job is never left on screen while a new
// one is in flight). No React rendering is involved — JobDescription.jsx
// is a direct, unconditional pass-through of this reducer's output into
// JSX branches, so testing the reducer IS testing the actual state
// transitions the page relies on. Run via
// `node src/tests/testJobDetailStates.js`.

import {
  JOB_DETAIL_STATUS,
  classifyJobDetailError,
  getInitialJobDetailState,
  jobDetailReducer,
} from "../utils/jobDetailState.js";
import { ApiError } from "../services/api.js";

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
console.log(" JOB DETAIL FETCH STATE MACHINE — DETERMINISTIC TESTS");
console.log("============================");

const SAMPLE_JOB = { _id: "60f7c2b5c1234567890000aa", title: "Backend Developer", company: "Acme" };

// ---------------------------------------------------------------------------
console.log("\n[1] Initial state starts in LOADING with no job yet — a direct visit never renders blank/undefined");
{
  const state = getInitialJobDetailState();
  check("initial status is LOADING", state.status === JOB_DETAIL_STATUS.LOADING);
  check("initial job is null (never undefined, never a stale placeholder)", state.job === null);
}

// ---------------------------------------------------------------------------
console.log("\n[2] FETCH_SUCCESS transitions to SUCCESS carrying exactly the resolved job, unmodified");
{
  const state = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_SUCCESS", job: SAMPLE_JOB });
  check("status becomes SUCCESS", state.status === JOB_DETAIL_STATUS.SUCCESS);
  check("job is the exact resolved object", state.job === SAMPLE_JOB);
  check("no error message lingers on a success", state.message === null);
}

// ---------------------------------------------------------------------------
console.log("\n[3] FETCH_START always resets to LOADING and clears any previously loaded job");
{
  const afterSuccess = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_SUCCESS", job: SAMPLE_JOB });
  check("sanity: job is loaded after a success", afterSuccess.job === SAMPLE_JOB);

  const afterNewStart = jobDetailReducer(afterSuccess, { type: "FETCH_START" });
  check(
    "a fresh FETCH_START (e.g. navigating from one job's detail page directly to another's) clears the previous job — never shown as belonging to the new id",
    afterNewStart.status === JOB_DETAIL_STATUS.LOADING && afterNewStart.job === null
  );
}

// ---------------------------------------------------------------------------
console.log("\n[4] classifyJobDetailError — 404 becomes NOT_FOUND (per BACKEND_API_CONTRACT.md §4, nonexistent and inactive alike)");
{
  const error = new ApiError("Job not found.", { status: 404 });
  check("404 -> NOT_FOUND", classifyJobDetailError(error) === JOB_DETAIL_STATUS.NOT_FOUND);

  const state = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_ERROR", error });
  check("FETCH_ERROR with a 404 ApiError -> NOT_FOUND state, job stays null", state.status === JOB_DETAIL_STATUS.NOT_FOUND && state.job === null);
}

// ---------------------------------------------------------------------------
console.log("\n[5] classifyJobDetailError — 400 (malformed id) becomes its own INVALID_ID state, distinct from NOT_FOUND");
{
  const error = new ApiError("Invalid job ID.", { status: 400 });
  check("400 -> INVALID_ID", classifyJobDetailError(error) === JOB_DETAIL_STATUS.INVALID_ID);
  check("INVALID_ID is a distinct value from NOT_FOUND (the UI can message them differently)", JOB_DETAIL_STATUS.INVALID_ID !== JOB_DETAIL_STATUS.NOT_FOUND);
}

// ---------------------------------------------------------------------------
console.log("\n[6] classifyJobDetailError — a general API failure (500) or network failure (no status) becomes the generic ERROR state, never NOT_FOUND");
{
  const serverError = new ApiError("Something went wrong. Please try again.", { status: 500 });
  check("500 -> ERROR, not NOT_FOUND (a real backend failure must not be mislabeled as \"job doesn't exist\")", classifyJobDetailError(serverError) === JOB_DETAIL_STATUS.ERROR);

  const networkError = new ApiError("Could not reach the server. Please check your connection and try again.", { status: null });
  check("network failure (status null) -> ERROR", classifyJobDetailError(networkError) === JOB_DETAIL_STATUS.ERROR);

  const state = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_ERROR", error: serverError });
  check("FETCH_ERROR with a 500 -> ERROR state carries the safe, normalized message (never a raw stack trace/axios internal)", state.status === JOB_DETAIL_STATUS.ERROR && state.message === "Something went wrong. Please try again.");
}

// ---------------------------------------------------------------------------
console.log("\n[7] An unknown action type is a no-op — the reducer never silently corrupts state on an unrecognized action");
{
  const before = jobDetailReducer(getInitialJobDetailState(), { type: "FETCH_SUCCESS", job: SAMPLE_JOB });
  const after = jobDetailReducer(before, { type: "SOME_UNKNOWN_ACTION" });
  check("state is returned unchanged for an unrecognized action", after === before);
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
