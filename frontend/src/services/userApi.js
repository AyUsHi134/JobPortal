import { apiClient } from "./api.js";

/** All require auth, token-derived identity */

/** Gets profile */
export async function getProfile() {
  const { data } = await apiClient.get("/api/user/profile");
  return data;
}

/** Updates profile */
export async function updateProfile(updates) {
  const { data } = await apiClient.put("/api/user/profile", updates);
  return data;
}

/** Saves job, returns ids */
export async function saveJob(jobId) {
  const { data } = await apiClient.post("/api/user/savejob", { jobId });
  return data.savedJobs;
}

/** Checks saved, returns boolean */
export async function isJobSaved(jobId) {
  const { data } = await apiClient.post("/api/user/issaved", { jobId });
  return data.isSaved;
}

/** Unsaves job, returns ids */
export async function unsaveJob(jobId) {
  const { data } = await apiClient.post("/api/user/unsavejob", { jobId });
  return data.savedJobs;
}
