import { apiClient } from "./api.js";

// The exact query parameters GET /api/jobs supports (BACKEND_API_CONTRACT.md
// §3). Kept as an explicit allowlist — mirroring the same "never forward
// unrecognized keys" philosophy the backend itself uses for its own request
// whitelisting — rather than blindly spreading whatever a future caller
// (e.g. Phase 2C's filter UI) passes in.
const JOB_QUERY_PARAM_KEYS = [
  "q",
  "experience_level",
  "is_tech_relevant",
  "is_remote",
  "country",
  "state",
  "city",
  "location",
  "source",
  "sort",
  "page",
  "limit",
];

/**
 * Builds a clean params object for GET /api/jobs from a loose `filters`
 * object, omitting any key that isn't one of the backend's own recognized
 * parameters and any value that's undefined/null/empty-string (so callers
 * can pass a full filter-state object, e.g. `{q: "", location: "Pune"}`,
 * without every unset field turning into a literal `?q=` in the request).
 * Exported so Phase 2C's filter UI can build/validate its own params
 * against the same logic without duplicating this list.
 */
export function buildJobQueryParams(filters = {}) {
  const params = {};
  for (const key of JOB_QUERY_PARAM_KEYS) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    params[key] = value;
  }
  return params;
}

/**
 * GET /api/jobs — search/filter/sort/pagination, per BACKEND_API_CONTRACT.md
 * §3. Returns `{ jobs, pagination }` (already unwrapped from the backend's
 * `{success, data, pagination}` envelope) — callers never need to know
 * about the envelope. Calling with no `filters` reproduces today's
 * call sites' behavior exactly (a plain "give me jobs" request), which
 * means the backend's own default pagination (page 1, limit 20) applies —
 * see PHASE_2B_REPORT.md for why this phase does not change that.
 */
export async function listJobs(filters = {}) {
  const { data } = await apiClient.get("/api/jobs", { params: buildJobQueryParams(filters) });
  return { jobs: data.data, pagination: data.pagination };
}

/**
 * GET /api/jobs/:id — per BACKEND_API_CONTRACT.md §4. Returns the job
 * object directly (unwrapped from `{success, data}`).
 */
export async function getJobById(id) {
  const { data } = await apiClient.get(`/api/jobs/${id}`);
  return data.data;
}

/**
 * POST /api/jobs — requires authentication (the apiClient's request
 * interceptor attaches the token automatically if the caller is logged
 * in; if not, the backend correctly responds 401 — see
 * BACKEND_API_CONTRACT.md §5). Returns the created job object.
 */
export async function createJob(jobData) {
  const { data } = await apiClient.post("/api/jobs", jobData);
  return data.data;
}

/** PUT /api/jobs/:id — requires authentication. Returns the updated job object. */
export async function updateJob(id, jobData) {
  const { data } = await apiClient.put(`/api/jobs/${id}`, jobData);
  return data.data;
}

/** DELETE /api/jobs/:id — requires authentication. Resolves with no value on success (204). */
export async function deleteJob(id) {
  await apiClient.delete(`/api/jobs/${id}`);
}
