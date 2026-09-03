import { apiClient } from "./api.js";

/**
 * All five functions below require authentication — the apiClient's
 * request interceptor attaches `Authorization: Bearer <token>`
 * automatically when a user is logged in (see api.js); none of these
 * functions accept or send a client-supplied user/owner id — the backend
 * derives the acting user from the verified token only
 * (BACKEND_API_CONTRACT.md §6/§7, PHASE_1I4_REPORT.md).
 */

/** GET /api/user/profile — returns the bare user object (password already excluded server-side). */
export async function getProfile() {
  const { data } = await apiClient.get("/api/user/profile");
  return data;
}

/** PUT /api/user/profile — body is `{name?, email?}`; returns the updated bare user object. */
export async function updateProfile(updates) {
  const { data } = await apiClient.put("/api/user/profile", updates);
  return data;
}

/** POST /api/user/savejob — body is `{jobId}` only. Returns the caller's full updated saved-jobs id list. */
export async function saveJob(jobId) {
  const { data } = await apiClient.post("/api/user/savejob", { jobId });
  return data.savedJobs;
}

/** POST /api/user/issaved — body is `{jobId}` only. Returns a boolean. */
export async function isJobSaved(jobId) {
  const { data } = await apiClient.post("/api/user/issaved", { jobId });
  return data.isSaved;
}

/** POST /api/user/unsavejob — body is `{jobId}` only. Returns the caller's full updated saved-jobs id list. */
export async function unsaveJob(jobId) {
  const { data } = await apiClient.post("/api/user/unsavejob", { jobId });
  return data.savedJobs;
}
