import { getJobById } from "../services/jobsApi.js";

/**
 * Loads saved jobs individually
 * @param {string[]} savedJobIds
 * @param {(id: string) => Promise<object>} [fetchJob]
 * @returns {Promise<{jobs: object[], unavailableCount: number}>}
 */
export async function loadSavedJobs(savedJobIds, fetchJob = getJobById) {
  const ids = Array.isArray(savedJobIds) ? savedJobIds : [];
  if (ids.length === 0) return { jobs: [], unavailableCount: 0 };

  const results = await Promise.allSettled(ids.map((id) => fetchJob(id)));
  const jobs = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  const unavailableCount = results.length - jobs.length;
  return { jobs, unavailableCount };
}
