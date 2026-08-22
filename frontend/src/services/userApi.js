import { apiClient } from "./api.js";

/**
 * All four functions below require authentication — the apiClient's
 * request interceptor attaches `Authorization: Bearer <token>`
 * automatically when a user is logged in (see api.js); none of these
 * functions accept or send a client-supplied user/owner id — the backend
 * derives the acting user from the verified token only
 * (BACKEND_API_CONTRACT.md §6/§7, PHASE_1I4_REPORT.md).
 *
 * NOTE — no `unsaveJob`/remove-saved-job function exists here. The
 * finalized backend contract has no corresponding endpoint (only
 * `savejob`/`issaved` exist — BACKEND_API_CONTRACT.md §6); adding one on
 * the frontend would call a URL the backend doesn't implement. This is a
 * known, documented gap (see FRONTEND_AUDIT.md §15 item 7 and
 * PHASE_2B_REPORT.md's known limitations) for a future backend phase to
 * close before a real "unsave" UI can be built.
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
