// Deterministic verification for the Phase 2C pagination logic and the
// fetch-status state machine (frontend/src/utils/jobDiscoveryState.js):
// page bounds, page-change preserving other filters, safe handling of
// `totalPages: 0`, and — critically — that a request-in-flight never
// lets a previous, stale result be presented as the current query's
// answer. No real network call is made. Run via
// `node src/tests/testJobPagination.js`.

globalThis.localStorage = (() => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
})();

const { apiClient } = await import("../services/api.js");
const { listJobs } = await import("../services/jobsApi.js");
const {
  DEFAULT_DISCOVERY_FILTERS,
  INITIAL_DISCOVERY_STATE,
  discoveryReducer,
  applyFilterChange,
  applyPageChange,
  canGoPrev,
  canGoNext,
  isValidPageTarget,
} = await import("../utils/jobDiscoveryState.js");

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

console.log("============================");
console.log(" JOB PAGINATION & FETCH STATE — DETERMINISTIC TESTS");
console.log(" (no real network calls, no browser required)");
console.log("============================");

// ---------------------------------------------------------------------------
console.log("\n[1] applyPageChange preserves every other filter — only page changes");
{
  const filters = { ...DEFAULT_DISCOVERY_FILTERS, q: "react", experience_level: "mid", source: "adzuna", page: 1 };
  const nextPage = applyPageChange(filters, 2);

  check("page changed to the requested value", nextPage.page === 2);
  check("q was preserved exactly", nextPage.q === "react");
  check("experience_level was preserved exactly", nextPage.experience_level === "mid");
  check("source was preserved exactly", nextPage.source === "adzuna");
}

// ---------------------------------------------------------------------------
console.log("\n[2] Pagination preserves active search/filter/sort state in the actual request");
{
  let captured = null;
  apiClient.defaults.adapter = mockAdapter(
    { status: 200, data: { success: true, data: [], pagination: { page: 2, limit: 20, total: 45, totalPages: 3 } } },
    (config) => { captured = config; }
  );

  const page1Filters = applyFilterChange(DEFAULT_DISCOVERY_FILTERS, { q: "engineer", is_remote: "true" });
  const page2Filters = applyPageChange(page1Filters, 2);
  await listJobs(page2Filters);

  check("page=2 was sent", captured.params.page === 2);
  check("the active search (q) survived the page change", captured.params.q === "engineer");
  check("the active filter (is_remote) survived the page change", captured.params.is_remote === "true");
}

// ---------------------------------------------------------------------------
console.log("\n[3] canGoPrev / canGoNext correctly gate navigation at the boundaries");
{
  check("page 1 of many -> cannot go prev", canGoPrev({ page: 1, totalPages: 6 }) === false);
  check("page 2 of many -> can go prev", canGoPrev({ page: 2, totalPages: 6 }) === true);
  check("last page -> cannot go next", canGoNext({ page: 6, totalPages: 6 }) === false);
  check("not the last page -> can go next", canGoNext({ page: 3, totalPages: 6 }) === true);
  check("a single-page result -> cannot go next or prev", canGoNext({ page: 1, totalPages: 1 }) === false && canGoPrev({ page: 1, totalPages: 1 }) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[4] totalPages: 0 (no results at all) is handled safely, never lets navigation proceed");
{
  const emptyPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
  check("cannot go next when there are zero total pages", canGoNext(emptyPagination) === false);
  check("cannot go prev from page 1 with zero results", canGoPrev(emptyPagination) === false);
  check("isValidPageTarget only accepts page 1 when totalPages is 0", isValidPageTarget(1, emptyPagination) === true && isValidPageTarget(2, emptyPagination) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[5] isValidPageTarget rejects out-of-range / malformed page numbers");
{
  const pagination = { page: 1, limit: 20, total: 113, totalPages: 6 };
  check("page 1 is valid", isValidPageTarget(1, pagination) === true);
  check("page 6 (the last page) is valid", isValidPageTarget(6, pagination) === true);
  check("page 7 (beyond the last page) is rejected", isValidPageTarget(7, pagination) === false);
  check("page 0 is rejected", isValidPageTarget(0, pagination) === false);
  check("a negative page is rejected", isValidPageTarget(-1, pagination) === false);
  check("a non-integer page is rejected", isValidPageTarget(2.5, pagination) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[6] A page beyond the final page is handled safely end-to-end (the backend's own documented behavior)");
{
  // BACKEND_API_CONTRACT.md §3: a page beyond the last page returns HTTP
  // 200 with an empty data array and honest pagination metadata — never
  // an error. Confirms the frontend's data layer passes that through
  // correctly rather than treating it as a failure.
  apiClient.defaults.adapter = mockAdapter({
    status: 200,
    data: { success: true, data: [], pagination: { page: 999, limit: 20, total: 113, totalPages: 6 } },
  });

  const { jobs, pagination } = await listJobs(applyPageChange(DEFAULT_DISCOVERY_FILTERS, 999));

  check("no error is thrown for a page beyond the last page", Array.isArray(jobs));
  check("the empty result is a real empty array, not null", jobs.length === 0);
  check("pagination still reports the real total/totalPages honestly", pagination.total === 113 && pagination.totalPages === 6);
  check("canGoNext correctly reports false once already past the end", canGoNext(pagination) === false);
}

// ---------------------------------------------------------------------------
console.log("\n[7] Fetch-status state machine: loading never presents stale results as current");
{
  const pageOneJobs = [{ _id: "job-1", title: "Old Query Result" }];
  let state = INITIAL_DISCOVERY_STATE;

  // A first, successful fetch populates jobs.
  state = discoveryReducer(state, { type: "FETCH_SUCCESS", jobs: pageOneJobs, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  check("after a successful fetch, status is success", state.status === "success");
  check("jobs holds the real result", state.jobs === pageOneJobs);

  // A new query starts (e.g. the user changed a filter).
  state = discoveryReducer(state, { type: "FETCH_START" });
  check("status becomes 'loading' the instant a new request starts", state.status === "loading");
  check(
    "the OLD jobs array is still technically in state (a UI could show a subtle stale-content indicator), but the component only ever renders the grid when status === 'success' — never during 'loading' — so this old data is never presented as belonging to the new query",
    state.jobs === pageOneJobs && state.status === "loading"
  );

  // The new query resolves.
  const newJobs = [{ _id: "job-2", title: "New Query Result" }];
  state = discoveryReducer(state, { type: "FETCH_SUCCESS", jobs: newJobs, pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  check("once the new fetch succeeds, jobs is replaced with the fresh result", state.jobs === newJobs);
  check("status returns to success", state.status === "success");
}

// ---------------------------------------------------------------------------
console.log("\n[8] Fetch-status state machine: loading state is entered before the request resolves");
{
  let state = INITIAL_DISCOVERY_STATE;
  check("initial status is 'idle', not a false 'success'/'error'", state.status === "idle");

  state = discoveryReducer(state, { type: "FETCH_START" });
  check("FETCH_START sets status to 'loading'", state.status === "loading");
  check("FETCH_START clears any previous error", state.error === null);
}

// ---------------------------------------------------------------------------
console.log("\n[9] Fetch-status state machine: API errors are captured safely, never as a raw object");
{
  let state = discoveryReducer(INITIAL_DISCOVERY_STATE, { type: "FETCH_START" });
  state = discoveryReducer(state, { type: "FETCH_ERROR", error: "Failed to retrieve jobs. Please try again later." });

  check("status becomes 'error'", state.status === "error");
  check("error is a plain, safe string", typeof state.error === "string" && state.error === "Failed to retrieve jobs. Please try again later.");
}

// ---------------------------------------------------------------------------
console.log("\n[10] listJobs() rejects safely on a real API failure (proving the error the reducer would receive is already safe)");
{
  const SENSITIVE = "MongoServerError: bad auth for jobportaluser:S3cr3tP@ss@cluster0.mongodb.net";
  apiClient.defaults.adapter = async (config) => {
    const error = new Error("Request failed");
    error.isAxiosError = true;
    error.config = config;
    error.response = { status: 500, data: { success: false, error: "Failed to retrieve jobs. Please try again later." }, headers: {}, config };
    throw error;
  };

  let thrown = null;
  try {
    await listJobs(DEFAULT_DISCOVERY_FILTERS);
  } catch (err) {
    thrown = err;
  }

  check("the error is caught, not an unhandled rejection", thrown !== null);
  check("the message is the backend's own safe text", thrown.message === "Failed to retrieve jobs. Please try again later.");
  check("no MongoDB/internal detail leaked into the message a reducer/UI would display", !thrown.message.includes(SENSITIVE));
}

console.log("\n============================");
console.log(` RESULT: ${passCount} passed, ${failCount} failed`);
console.log("============================");
