import { getJobById } from "../services/jobsApi.js";

/**
 * Orchestrates the Saved Jobs page's data flow: `BACKEND_API_CONTRACT.md`
 * §6/§7 has no single "list my saved jobs" endpoint, only a
 * `savedJobs` id array on the profile object — so loading the actual
 * saved jobs means requesting each one individually via the same
 * `jobsApi.getJobById()` Phase 2D already uses. A previously-saved job
 * can later 404 (expired/removed/deactivated, per §4's lifecycle rule);
 * `Promise.allSettled` means one such failure never breaks the whole
 * page, and `unavailableCount` makes that gap visible instead of
 * silently hiding it. `fetchJob` is injectable so this can be unit-
 * tested with a fake fetcher — no network/React involved.
 *
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
