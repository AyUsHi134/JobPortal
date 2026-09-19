import { apiClient } from "./api.js";

// Allowlist of supported query params
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
  "language",
  "sort",
  "page",
  "limit",
];

/** Builds clean params object */
export function buildJobQueryParams(filters = {}) {
  const params = {};
  for (const key of JOB_QUERY_PARAM_KEYS) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    params[key] = value;
  }
  return params;
}

/** Lists jobs, returns unwrapped result */
export async function listJobs(filters = {}) {
  const { data } = await apiClient.get("/api/jobs", { params: buildJobQueryParams(filters) });
  return { jobs: data.data, pagination: data.pagination, guestLimitReached: data.guestLimitReached };
}

/** Gets one job, unwrapped */
export async function getJobById(id) {
  const { data } = await apiClient.get(`/api/jobs/${id}`);
  return data.data;
}

/** Creates job, requires auth */
export async function createJob(jobData) {
  const { data } = await apiClient.post("/api/jobs", jobData);
  return data.data;
}

/** Updates job, requires auth */
export async function updateJob(id, jobData) {
  const { data } = await apiClient.put(`/api/jobs/${id}`, jobData);
  return data.data;
}

/** Deletes job, requires auth */
export async function deleteJob(id) {
  await apiClient.delete(`/api/jobs/${id}`);
}
